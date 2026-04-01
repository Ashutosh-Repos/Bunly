<div align="center">
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3"/>
    <path d="M13 16a3 3 0 0 1 2.24 5"/>
    <path d="M18 12h.01"/>
    <path d="M20 8.54V4a2 2 0 1 0-4 0v3"/>
    <path d="M7.612 12.524a3 3 0 1 0-1.6 4.3"/>
  </svg>
  <h1>Bunly</h1>
  <p><strong>A high-performance, feature-rich Video-On-Demand (VOD) platform engineered for the modern web.</strong></p>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-Backend-20232A?style=for-the-badge&logo=fastify)](https://fastify.io/)
[![Redis](https://img.shields.io/badge/Redis-Streams_&_BullMQ-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-HLS_Transcoding-007808?style=for-the-badge&logo=ffmpeg)](https://ffmpeg.org/)
[![Prisma](https://img.shields.io/badge/Prisma-Postgres-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io/)

</div>

<br />

Welcome to **Bunly**! 👋

I built this project to explore the fascinating engineering challenges behind modern video streaming platforms. Unlike traditional monolithic applications, streaming requires handling massive file uploads, processing expensive background rendering tasks, and protecting databases from sudden, viral traffic spikes—all without compromising the user experience.

Bunly is a deeply engineered, full-stack streaming platform built to replicate the complexity and scale of modern social video networks. It goes far beyond standard video playback—featuring algorithmic feeds, interactive creator communities, and a massively decoupled microservices architecture designed to handle severe traffic spikes and heavy video rendering without dropping a frame.

Bunly is my answer to these challenges. It is a deeply decoupled, event-driven microservices architecture that prioritizes resilience, performance, and clean code. Whether you're a recruiter exploring my system design skills or a fellow developer looking for inspiration on HLS transcoding, I hope you find this repository valuable.

---

## 📖 Table of Contents

- [✨ Core Features](#-core-features)
- [🏛️ System Architecture](#-system-architecture)
- [🛠️ The Technology Stack](#-the-technology-stack)
- [🚀 Local Development & Deployment](#-local-development--deployment)
- [🔮 Future Roadmap](#-future-roadmap)

---

## ✨ Core Features

Bunly is packed with features designed for both content creators and highly engaged viewers.

### 🎥 The Viewer Experience

- **Algorithmic Discovery feeds**: The backend constantly calculates a user's `Interest Score` based on watch time, categories, and tags. Videos are dynamically sorted using real-time `trendingScore` and `hotScore` metrics.
- **Adaptive Streaming (HLS)**: Videos automatically adjust in quality (1080p, 720p, 480p) depending on the user's internet connection.
- **Rich Interactions**: Features deeply nested comment threads, timestamped Video Chapters, and "Watch Later" playlists.

### 🎙️ The Creator Studio

- **Community Posts & Polls**: Creators can interact with subscribers via text posts, image carousels, and interactive voting polls without needing to upload a video.
- **Live Notifications**: When a creator uploads, WebSocket connections tunnel push alerts directly to their subscribers' notification bells.
- **Advanced Analytics**: Creators can track detailed metrics powered by the backend's `watch_history` tracking logic.

### 🛡️ Enterprise-Grade Moderation

- **Admin Dashboard**: Comprehensive CMS to manage `reports` and issue `strikes` (Copyright, Community Guidelines) against offending channels.
- **Automated Takedowns**: Videos reaching specific strike thresholds are automatically unlisted or removed.

---

## 🏛️ System Architecture

To ensure the user interface remains snappy even while the servers process heavy 4K video streams, Bunly is cleanly separated into four specialized environments.

```mermaid
graph TD
    Client[Web Client (React 19)] -->|Direct S3 Upload| S3[AWS S3 / MinIO]
    Client -->|tRPC / Auth| Next[Next.js SSR Proxy]
    Next -->|API Calls| Fastify[Fastify Core API]

    Fastify -->|Queues Video Task| BullMQ[BullMQ (Redis)]
    Fastify -->|Streams Fast Events| RedisStreams[Redis Streams]
    Fastify -->|Standard Queries| Postgres[(PostgreSQL)]

    BullMQ --> Transcoder[FFmpeg Transcoder]
    Transcoder -.->|Uploads HLS Chunks| S3

    RedisStreams --> WorkerPool[Background Worker Pool]
    WorkerPool -.->|Batched Flushes| Postgres
```

### 1. The Zero-Buffer Pipeline

When a user uploads a high-resolution video, processing it blindly on the main server would instantly drain its memory. Here is how Bunly solves this:

- **Direct-to-Cloud Uploads**: The API never touches the video payload. Instead, it generates an AWS SDK Presigned URL. The user's browser pushes the gigabytes _directly_ to the S3 bucket.
- **Chunking on the Fly**: A containerized FFmpeg Transcoding Worker downloads the file safely via BullMQ and parallelizes the rendering into 4-second `.ts` chunks. As chunks are created, they are streamed back to S3 and deleted locally to save SSD space.

### 2. The Resilient Engagement Engine

If a video goes viral, thousands of concurrent updates to Postgres (for Likes or Views) would bottleneck the connection pool.

- **Stream Buffering**: The API rapidly offloads these rapid clicks into **Redis Streams**, responding to the user in milliseconds.
- **Batch Flushing**: In the background, the Worker Pool safely aggregates the math and flushes thousands of updates into Postgres via a single transaction every 15 seconds.

---

## 🛠️ The Technology Stack

| Domain          | Technologies Used                                | Why I Chose It                                                                                                                                                      |
| :-------------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend UI** | Next.js 16, React 19, Tailwind v4, Framer Motion | Provides a hyper-responsive interface. Next.js natively proxies Auth to ensure `SameSite: Lax` tracking cookies bypass cross-origin browser bans.                   |
| **Core API**    | Fastify, tRPC, WebSockets, Zod                   | Blazing-fast Node.js HTTP routing. Perfect for negotiating S3 connections and streaming live WebSocket progress bars back to the user without blocking event loops. |
| **Worker Pool** | Node.js, BullMQ, Redis Streams                   | The central nervous system. Elegantly handles background Email dispatch (Brevo) and massive Notification Fan-outs to millions of subscribers.                       |
| **Transcoder**  | FFmpeg, Alpine Linux                             | A highly tuned environment implementing `dumb-init` to safely reap orphaned rendering processes without causing memory leaks.                                       |
| **Database**    | PostgreSQL, Prisma ORM                           | Deeply normalized, relationship-heavy storage tracking over 15+ complex schemas including Videos, Channels, and Audit Logs.                                         |

---

## 🚀 Local Development & Deployment

Bunly is heavily Dockerized and structurally optimized for cloud providers like Railway, AWS ECS, or your own local machine.

### Enterprise-Grade Containerization

I paid special attention to making the Docker lifecycle production-ready:

- **Graceful Shutdowns (`dumb-init`)**: The background workers utilize `dumb-init` as `PID 1` to gracefully intercept kill signals and reap orphaned `ffmpeg` child processes, preventing memory leaks and zombie processes.
- **Privilege Dropping**: For security, all worker containers automatically drop root permissions and execute under an isolated `node` user profile.
- **Micro-Dependencies**: Leveraging multi-stage caching and strict dependency pruning (`pnpm prune --prod`) keeps the Docker images incredibly lightweight.

### Quick Start Guide

To spin up the entire cluster locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Bunly.git
   ```
2. Set up your environments:
   Take a look at [railway_variables_template.env.example](./railway_variables_template.env.example) to see how the secrets are mapped across the microservices. Copy the respective variables to your local `.env` files.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start the ecosystem:
   ```bash
   docker-compose up -d
   ```

---

## 🔮 Future Roadmap

Architecture is an ongoing journey. As Bunly scales, I am actively exploring the following enhancements:

- [ ] **Kubernetes Autoscaling**: Transitioning from Docker Compose to a Helm-based K8s deployment. This will allow the system to dynamically spin up new FFmpeg Transcoding pods based strictly on fluctuating BullMQ video queues.
- [ ] **Edge CDN Integration**: Binding an Edge CDN (like Cloudflare or AWS CloudFront) directly to the S3 bucket to dramatically reduce latency on HLS video chunk delivery for international users.
- [ ] **AI Content Moderation**: Integrating an automated ML moderation service into the Transcoder's initial `probe` phase to intelligently scan keyframes for explicit content before generating master playlists.

<br />
<div align="center">
  <i>Built with passion, precision, and coffee.</i>
</div>
