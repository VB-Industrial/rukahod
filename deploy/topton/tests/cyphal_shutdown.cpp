// Regression: destruction must finish even when start_threads() was never called.
// Only isolated vcan_relaytest is opened; no frames are published.
#include <chrono>
#include <thread>
#include <filesystem>
#include "cyphal/allocators/o1/o1_allocator.h"
#include "cyphal/cyphal.h"
#include "cyphal/providers/LinuxCAN.h"
uint64_t now_us() {
  return std::chrono::duration_cast<std::chrono::microseconds>(
    std::chrono::steady_clock::now().time_since_epoch()).count();
}
int errors = 0;
void error() { ++errors; }
size_t fd_count() {
  return std::distance(std::filesystem::directory_iterator("/proc/self/fd"),
                       std::filesystem::directory_iterator{});
}
int main() {
  UtilityConfig utilities(now_us, error);
  const auto before = fd_count();
  for (int cycle = 0; cycle < 100; ++cycle) {
    const bool threaded = cycle % 2;
    auto interface = CyphalInterface::create_heap<LinuxCAN, O1Allocator>(
      123, "vcan_relaytest", 32, utilities);
    if (!interface->is_up()) return 1;
    if (threaded) {
      interface->start_threads(1000);
      std::this_thread::sleep_for(std::chrono::milliseconds(30));
    }
    interface.reset();
    if (errors || fd_count() != before) return 2;
  }
}
