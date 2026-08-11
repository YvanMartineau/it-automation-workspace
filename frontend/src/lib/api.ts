import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // required so the httpOnly refresh_token cookie is sent/received
  timeout: 10000,
});