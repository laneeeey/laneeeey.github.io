import axios from 'axios';

const isDevelopment = import.meta.env.DEV;
const baseURL = isDevelopment ? "/api" : "https://api.hannoon.shop";

const http = axios.create({
  baseURL,
  withCredentials: false,
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.debug('HTTP ERROR:', status, data);
    return Promise.reject(err);
  }
);

export default http;
