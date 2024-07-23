FROM nvidia/cuda:12.4.0-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y python3 python3-pip python3-apt
# Install system dependencies
RUN apt-get install -y software-properties-common
# Install system dependencies
RUN add-apt-repository ppa:graphics-drivers/ppa -y

RUN apt-get update && apt-get install -y \
    # nvidia-graphics-drivers-550 \
    nvidia-driver-550 \
    libnvidia-gl-550 \
    vulkan-tools

# Command to run the application
ENTRYPOINT ["/opt/nvidia/nvidia_entrypoint.sh"]