#include <array>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <memory>
#include <stdexcept>
#include <string>

#include "cyphal/cyphal.h"
#include "cyphal/subscriptions/subscription.h"
#include "rclcpp/rclcpp.hpp"
#include "silverhand_rover_control/cyphal/runtime.hpp"
#include "std_srvs/srv/set_bool.hpp"
#include "uavcan/primitive/array/Integer8_1_0.h"

TYPE_ALIAS(LightsMsg, uavcan_primitive_array_Integer8_1_0)

namespace
{

constexpr auto kSpinPeriod = std::chrono::milliseconds(50);
constexpr std::size_t kHeartbeatLoopCount = 20U;

class HeadlightsNode : public rclcpp::Node
{
public:
  HeadlightsNode()
  : Node("headlights_node")
  {
    declare_parameter<bool>("use_mock", false);
    declare_parameter<std::string>("can_iface", "vcan1");
    declare_parameter<int>("node_id", 111);
    declare_parameter<int>("queue_len", 1000);
    declare_parameter<int>("headlights_port_id", 3000);
    declare_parameter<std::string>("relay_state_file", "");

    use_mock_ = get_parameter("use_mock").as_bool();
    headlights_port_id_ = static_cast<std::uint16_t>(get_parameter("headlights_port_id").as_int());

    state_file_ = get_parameter("relay_state_file").as_string();
    load_state();
    arm_power_service_ = create_service<std_srvs::srv::SetBool>(
      "/power_board/set_arm_power",
      [this](const std::shared_ptr<std_srvs::srv::SetBool::Request> request,
             std::shared_ptr<std_srvs::srv::SetBool::Response> response) {
        // NC contact: 0 supplies the arm, 1 cuts its power.
        set_output(0, request->data ? 0 : 1, response);
      });
    headlights_service_ = create_service<std_srvs::srv::SetBool>(
      "/power_board/set_headlights",
      std::bind(&HeadlightsNode::handle_headlights, this, std::placeholders::_1, std::placeholders::_2));

    if (use_mock_) {
      RCLCPP_INFO(get_logger(), "Starting headlights_node in mock mode; hardware access is disabled");
      return;
    }

    const auto can_iface = get_parameter("can_iface").as_string();
    const auto node_id = static_cast<std::uint16_t>(get_parameter("node_id").as_int());
    const auto queue_len = static_cast<std::size_t>(get_parameter("queue_len").as_int());

    runtime_ = std::make_unique<silverhand_rover_control::cyphal::Runtime>();
    if (!runtime_->start(can_iface, node_id, queue_len)) {
      throw std::runtime_error("Failed to start Cyphal runtime for headlights_node");
    }

    relay_reader_ = std::make_unique<RelayReader>(runtime_->interface(), headlights_port_id_, this);
    timer_ = create_wall_timer(kSpinPeriod, std::bind(&HeadlightsNode::spin_once, this));
  }

  ~HeadlightsNode() override
  {
    shutdown_runtime();
  }

private:
  class RelayReader : public AbstractSubscription<LightsMsg>
  {
  public:
    RelayReader(const InterfacePtr & interface, CanardPortID port, HeadlightsNode * node)
    : AbstractSubscription<LightsMsg>(interface, port), node_(node) {}
    void handler(const LightsMsg::Type & message, CanardRxTransfer *) override
    {
      if (message.value.count != 2) return;
      const auto arm = message.value.elements[0];
      const auto lights = message.value.elements[1];
      if ((arm != 0 && arm != 1) || (lights != 0 && lights != 1)) return;
      const std::array<int, 2> observed{arm, lights};
      if (observed == node_->outputs_) return;
      node_->outputs_ = observed;
      node_->save_state(observed);
      RCLCPP_INFO(node_->get_logger(), "Observed relay command [%d, %d]", arm, lights);
    }
  private:
    HeadlightsNode * node_;
  };

  void load_state()
  {
    if (state_file_.empty()) return;
    std::ifstream file(state_file_);
    int arm = -1, lights = -1;
    std::string extra;
    if ((file >> arm >> lights) && !(file >> extra) &&
        (arm == 0 || arm == 1) && (lights == 0 || lights == 1)) {
      outputs_ = {arm, lights};
      RCLCPP_INFO(get_logger(), "Loaded last relay command [%d, %d]; no startup publish", arm, lights);
    } else {
      RCLCPP_WARN(get_logger(), "Relay state unknown; initialize by an explicit two-channel command");
    }
  }

  bool save_state(const std::array<int, 2> & values)
  {
    if (state_file_.empty() || use_mock_) return true;
    try {
      const std::filesystem::path path(state_file_);
      if (!path.parent_path().empty()) std::filesystem::create_directories(path.parent_path());
      const auto temporary = state_file_ + ".tmp";
      std::ofstream file(temporary, std::ios::trunc);
      file.exceptions(std::ios::failbit | std::ios::badbit);
      file << values[0] << ' ' << values[1] << '\n';
      file.close();
      std::filesystem::rename(temporary, path);
      return true;
    } catch (const std::exception & error) {
      RCLCPP_ERROR(get_logger(), "Cannot persist relay state: %s", error.what());
      return false;
    }
  }

  void shutdown_runtime()
  {
    if (timer_) {
      timer_->cancel();
      timer_.reset();
    }
    headlights_service_.reset();
    arm_power_service_.reset();
    relay_reader_.reset();
    if (runtime_) {
      runtime_->stop();
      runtime_.reset();
    }
  }

  void spin_once()
  {
    if (!runtime_) {
      return;
    }

    runtime_->spin_once();
    ++loop_counter_;
    if (loop_counter_ >= kHeartbeatLoopCount) {
      runtime_->publish_heartbeat();
      loop_counter_ = 0U;
    }
  }

  void handle_headlights(
    const std::shared_ptr<std_srvs::srv::SetBool::Request> request,
    std::shared_ptr<std_srvs::srv::SetBool::Response> response)
  {
    set_output(1, request->data ? 1 : 0, response);
  }

  void set_output(std::size_t channel, int value,
    const std::shared_ptr<std_srvs::srv::SetBool::Response> & response)
  {
    if (!use_mock_ && (!runtime_ || !runtime_->is_started())) {
      response->success = false;
      response->message = "Relay Cyphal runtime is not started";
      return;
    }
    // Never guess the other channel: switching lights must not power-cycle the arm.
    if (outputs_[1 - channel] < 0) {
      response->success = false;
      response->message = "Other relay channel unknown; initialize both outputs explicitly";
      return;
    }
    auto next = outputs_;
    next[channel] = value;
    if (!save_state(next)) {
      response->success = false;
      response->message = "Cannot persist relay state; command not sent";
      return;
    }
    if (!use_mock_) {
      LightsMsg::Type message = {};
      message.value.count = 2;
      message.value.elements[0] = static_cast<std::int8_t>(next[0]);
      message.value.elements[1] = static_cast<std::int8_t>(next[1]);
      runtime_->interface()->send_msg<LightsMsg>(&message, headlights_port_id_, &headlights_transfer_id_);
    }
    outputs_ = next;
    response->success = true;
    response->message = "Relay command sent [" + std::to_string(next[0]) + ", " + std::to_string(next[1]) + "] (no hardware readback)";
    RCLCPP_INFO(get_logger(), "%s", response->message.c_str());
  }

  std::unique_ptr<silverhand_rover_control::cyphal::Runtime> runtime_;
  rclcpp::TimerBase::SharedPtr timer_;
  std::unique_ptr<RelayReader> relay_reader_;
  rclcpp::Service<std_srvs::srv::SetBool>::SharedPtr arm_power_service_;
  std::array<int, 2> outputs_{-1, -1};
  std::string state_file_;
  rclcpp::Service<std_srvs::srv::SetBool>::SharedPtr headlights_service_;
  std::uint16_t headlights_port_id_{3000};
  bool use_mock_{false};
  std::size_t loop_counter_{0};
  CanardTransferID headlights_transfer_id_{0};
};

}  // namespace

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<HeadlightsNode>();
  rclcpp::spin(node);
  node.reset();
  rclcpp::shutdown();
  return 0;
}
