FROM nvidia/cuda:12.2.0-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    python3 \
    python3-pip \
    vulkan-tools \
    nvidia-driver-525 \
    nvidia-utils-525 \
    libnvidia-gl-525

RUN vulkaninfo

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Install Playwright and browsers
RUN playwright install-deps
RUN playwright install chrome

# Set up the working directory
WORKDIR /app

# Copy the application code
COPY . /app

# Expose the port your application will run on
EXPOSE 8000

# Command to run the application
CMD ["python3", "main.py"]