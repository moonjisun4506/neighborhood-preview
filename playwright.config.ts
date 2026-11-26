import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,reporter:'list',use:{baseURL:'http://localhost:3000',channel:'chrome',headless:true},webServer:{command:'npm.cmd run dev -- --hostname 127.0.0.1',url:'http://localhost:3000',reuseExistingServer:true,timeout:120000}});
