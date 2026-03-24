🚀 FluxAI – Backend (Node.js + Express + MongoDB)

This is the backend service for the FluxAI customer support platform.
It provides APIs for:

AI chat processing

Document upload & management

FAQ storage

Authentication (JWT-based)

Chat history

RAG-lite document grounding

Powered by Node.js, Express, MongoDB, and cloud deployment on Render.

🧠 Features
🔹 AI Chat API

Supports multiple LLM providers:
Groq

Real-time streaming responses using Server-Sent Events.

🔹 Document Upload System

Upload PDF/DOCX

Stored in /uploads

AI uses documents via URLs

Lightweight, Render-friendly (no heavy parsing)

🔹 FAQ Management

Admin can add/edit/delete FAQs

AI uses FAQs for contextual responses

🔹 Authentication

JWT-based login

User + Admin roles

🔹 Chat History

Stores user conversation logs

Multi-session support

🏗️ Tech Stack

Node.js

Express.js

MongoDB + Mongoose

Multer (file uploads)

JWT Authentication

SSE for streaming

Render for deployment
📁 Project Structure
controllers/
models/
routes/
services/
uploads/
server.js
.env
▶️ Run Locally
npm install
npm start
Create .env:

MONGODB_URI=yourMongoURI
OPENAI_API_KEY=yourKey
LLM_PROVIDER=openai
BASE_URL=http://localhost:5000

🌐 Deployment

Backend LIVE URL (Render):

https://fluxai-910t.onrender.com





