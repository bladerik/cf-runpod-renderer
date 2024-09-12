FROM nvidia/cuda:12.4.0-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    python3 \
    python3-pip \
    nvidia-driver-550 \
    libnvidia-gl-550 \
    vulkan-tools \
    libgl1-mesa-dev \
    xvfb \
    libxi-dev \
    libxcursor-dev \
    libxdamage-dev \
    libxrandr-dev \
    libxcomposite-dev \
    libxext-dev \
    libxfixes-dev \
    libxrender-dev \
    libgles2-mesa-dev \
    libegl1-mesa-dev \
    libgbm-dev \
    libglu1-mesa \
    libxi6 \
    libxrender1 \
    libxrandr2 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxshmfence1 \
    mesa-utils \
    libvulkan1

# Download and install NVIDIA driver
# RUN DRIVER_URL="https://us.download.nvidia.com/tesla/535.104.12/NVIDIA-Linux-x86_64-535.104.12.run" && \
#     DRIVER_NAME="NVIDIA-Linux-driver.run" && \
#     wget -O "$DRIVER_NAME" "$DRIVER_URL" && \
#     sh "$DRIVER_NAME" --disable-nouveau --silent && \
#     rm "$DRIVER_NAME"

# Install Playwright and browsers
RUN pip3 install playwright
RUN playwright install-deps
RUN playwright install chrome

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Set up the working directory
WORKDIR /app

# Copy the application code
COPY . /app

# Expose the port your application will run on
EXPOSE 8000

# Command to run the application
CMD ["python3", "main.py"]