# Productivity Management Dashboard Backend

This project is a simple backend API for a productivity management dashboard built using Node.js, Express, and MySQL. It supports JWT-based authentication, role-based access control (User and Admin), and task management.

## Tech Stack
Node.js  
Express.js  
MySQL  
JWT Authentication  
bcrypt  
Zod  

## Setup

Install dependencies:
npm install

Create database:
CREATE DATABASE productivity_db;

Start server:
node app.js

Server runs at:
http://localhost:3000

## Authentication

Signup:
POST /signup

Login:
POST /login

Use the JWT token in headers:
Authorization: Bearer <token>

## User APIs

POST /tasks  
GET /tasks  
PUT /tasks/:id  
DELETE /tasks/:id  
GET /tasks/search  
GET /dashboard  

## Admin APIs

GET /admin/tasks  
GET /admin/dashboard  

## Notes

Users can only access and manage their own tasks.  
Admins can access all tasks and global analytics.  
All protected routes require a valid JWT token.
