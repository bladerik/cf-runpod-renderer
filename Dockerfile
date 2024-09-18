FROM sitespeedio/node:ubuntu-22.04-nodejs-18.18.0

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Needed to share GPU
ENV NVIDIA_DRIVER_CAPABILITIES=all
ENV NVIDIA_VISIBLE_DEVICES=all

# RUN apt-get update \
#     && apt-get install -y software-properties-common libvulkan1

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        build-essential \
        g++ \
        libxinerama-dev \
        libxext-dev \
        libxrandr-dev \
        libxi-dev \
        libxcursor-dev \
        libxxf86vm-dev \
        libvulkan-dev \
        python3 \
        python3-pip \
        dumb-init \
        mesa-vulkan-drivers \
        vulkan-tools \
        curl \
        wget \
        xz-utils \
        xvfb && \
    rm -rf /var/lib/apt/lists/*



RUN npx -y playwright@1.47.0 install --with-deps chrome firefox

# Install FFmpeg
RUN wget https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-6.0.1-amd64-static.tar.xz \
    && tar xvf ffmpeg-6.0.1-amd64-static.tar.xz \
    && mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ \
    && mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ \
    && rm -rf ffmpeg-*-amd64-static*

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Set up the working directory
WORKDIR /app

# Copy the application code

COPY package*.json ./
COPY .npmrc ./

RUN npm ci

COPY . .
COPY tsconfig.json ./

RUN npm install typescript@5 -g
RUN npx tsc -v && sleep 3
RUN npm run build

# Expose the port your application will run on
EXPOSE 8000

# reset entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--", "xvfb-run", "--auto-servernum", "--server-args",  "-screen 0 1280x1024x24 -ac"]
# Command to run the application
CMD ["python3", "main.py"]