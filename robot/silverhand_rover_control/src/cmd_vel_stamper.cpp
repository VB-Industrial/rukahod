#include <memory>
#include "geometry_msgs/msg/twist.hpp"
#include "geometry_msgs/msg/twist_stamped.hpp"
#include "rclcpp/rclcpp.hpp"

// Preserve SilverHand's Twist endpoint for clients while Jazzy's controller uses TwistStamped.
int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<rclcpp::Node>("rover_cmd_vel_stamper");
  auto publisher = node->create_publisher<geometry_msgs::msg::TwistStamped>(
    "/rover_base_controller/cmd_vel", 1);
  auto subscription = node->create_subscription<geometry_msgs::msg::Twist>(
    "/rover_base_controller/cmd_vel_unstamped", 1,
    [node, publisher](geometry_msgs::msg::Twist::ConstSharedPtr twist) {
      geometry_msgs::msg::TwistStamped message;
      message.header.stamp = node->now();
      message.header.frame_id = "base_link";
      message.twist = *twist;
      publisher->publish(message);
    });
  rclcpp::spin(node);
  subscription.reset();
  node.reset();
  rclcpp::shutdown();
  return 0;
}
