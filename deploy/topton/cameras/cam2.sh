#!/usr/bin/env bash
set -euo pipefail
camera_device="${RUKAHOD_ARM_CAMERA_DEVICE:-/dev/v4l/by-path/pci-0000:00:14.0-usb-0:4:1.0-video-index2}"
camera_sdk="${RUKAHOD_H264_SDK:-/home/rosuser/H264_Driver_AP_SDK/Linux_UVC_TestAP/H264_UVC_TestAP}"
"$camera_sdk" "$camera_device" --xuset-cvm 2 --xuset-gop 25 --xuset-if 25 --xuset-qp 32 --xuget-sei 1
exec ffmpeg -f v4l2 -input_format h264 -video_size 1280x720 -framerate 25 \
  -i "$camera_device" -vcodec copy -an -flags low_delay -max_delay 0 \
  -probesize 32 -fflags nobuffer -analyzeduration 0 \
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/cam2
