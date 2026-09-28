#include "silverhand_rover_control/cyphal/runtime.hpp"

#include <chrono>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <memory>
#include <string>

#include "cyphal/allocators/o1/o1_allocator.h"
#include "cyphal/cyphal.h"
#include "cyphal/providers/LinuxCAN.h"
#include "cyphal/subscriptions/subscription.h"
#include "uavcan/node/Heartbeat_1_0.h"

TYPE_ALIAS(HeartbeatMsg, uavcan_node_Heartbeat_1_0)

namespace
{

void error_handler()
{
  std::exit(EXIT_FAILURE);
}

std::uint64_t micros_64()
{
  using namespace std::chrono;
  return duration_cast<microseconds>(steady_clock::now().time_since_epoch()).count();
}

UtilityConfig g_utilities(micros_64, error_handler);

}  // namespace

namespace silverhand_rover_control::cyphal
{

class HeartbeatReader final : public AbstractSubscription<HeartbeatMsg>
{
public:
  explicit HeartbeatReader(const InterfacePtr & interface)
  : AbstractSubscription<HeartbeatMsg>(interface, uavcan_node_Heartbeat_1_0_FIXED_PORT_ID_)
  {
  }

  void handler(const HeartbeatMsg::Type & /*message*/, CanardRxTransfer * transfer) override
  {
    if (transfer == nullptr) {
      return;
    }
    const auto node_id = transfer->metadata.remote_node_id;
    if (node_id < last_seen_.size()) {
      last_seen_[node_id] = std::chrono::steady_clock::now();
    }
  }

  bool all_recent(const std::vector<std::uint16_t> & node_ids, std::chrono::milliseconds timeout) const
  {
    if (node_ids.empty()) {
      return false;
    }
    const auto now = std::chrono::steady_clock::now();
    for (const auto node_id : node_ids) {
      if (node_id >= last_seen_.size() ||
        last_seen_[node_id] == std::chrono::steady_clock::time_point{} ||
        now - last_seen_[node_id] > timeout)
      {
        return false;
      }
    }
    return true;
  }

private:
  std::array<std::chrono::steady_clock::time_point, 128> last_seen_{};
};

Runtime::Runtime() = default;

Runtime::~Runtime()
{
  stop();
}

bool Runtime::start(const std::string & can_iface, const std::uint16_t node_id, const std::size_t queue_len)
{
  stop();

  interface_ = CyphalInterface::create_heap<LinuxCAN, O1Allocator>(
    node_id, can_iface.c_str(), queue_len, g_utilities);

  if (!interface_ || !interface_->is_up()) {
    stop();
    return false;
  }
  heartbeat_reader_ = std::make_unique<HeartbeatReader>(interface_);

  uptime_seconds_ = 0;
  heartbeat_transfer_id_ = 0;
  return interface_ && interface_->is_up();
}

void Runtime::stop()
{
  heartbeat_reader_.reset();
  interface_.reset();
  uptime_seconds_ = 0;
  heartbeat_transfer_id_ = 0;
}

void Runtime::spin_once() const
{
  if (interface_) {
    interface_->loop();
  }
}

bool Runtime::is_started() const
{
  return interface_ && interface_->is_up();
}

bool Runtime::heartbeat_ready(
  const std::vector<std::uint16_t> & node_ids, std::chrono::milliseconds timeout) const
{
  return heartbeat_reader_ && heartbeat_reader_->all_recent(node_ids, timeout);
}

void Runtime::publish_heartbeat()
{
  if (!interface_) {
    return;
  }

  HeartbeatMsg::Type heartbeat = {
    .uptime = uptime_seconds_,
    .health = {uavcan_node_Health_1_0_NOMINAL},
    .mode = {uavcan_node_Mode_1_0_OPERATIONAL}
  };

  interface_->send_msg<HeartbeatMsg>(
    &heartbeat,
    uavcan_node_Heartbeat_1_0_FIXED_PORT_ID_,
    &heartbeat_transfer_id_);
  ++uptime_seconds_;
}

std::shared_ptr<CyphalInterface> Runtime::interface() const
{
  return interface_;
}

}  // namespace silverhand_rover_control::cyphal
