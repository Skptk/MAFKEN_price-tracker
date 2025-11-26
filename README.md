# aggregateDuka - Carrefour Price Tracker

aggregateDuka is a modern, real-time price tracking dashboard designed to help users monitor product prices on Carrefour Kenya. It provides a sleek interface to track price fluctuations, identify deals, and visualize savings over time with intelligent offer detection and predictive analytics.

## 🚀 Features

### 📊 Interactive Dashboard
- **Real-time Stats**: Instantly view total tracked products, active offers, total calculated savings, and the last update timestamp.
- **Smart Status Tags**: Visual indicators showing offer state:
  - 🟢 **Offer Available** - Active discount
  - 🔴 **Offer Ended** - Recent offer ended
  - 🟠 **Possible Return** - Predictive tag based on historical patterns
  - ⚪ **Tracking Offer Logic** - Learning product patterns
- **Responsive Design**: A fully responsive layout with a collapsible sidebar for desktop and mobile-friendly navigation.

### 🛍️ Product Tracking
- **Easy Addition**: Simply paste a Carrefour product URL to start tracking. The system automatically scrapes the product name, SKU, price, and image.
- **Price History**: View historical price data for each product to understand trends and make informed buying decisions.
- **Deal Detection**: Automatically calculates discounts and highlights products selling below their original or retail price.
- **Project Organization**: Group products into custom projects (e.g., "Groceries", "Tech", "Wishlist") and reassign them anytime.

### 🔔 Intelligent Notifications
- **Offer Start Alerts**: Get notified when new offers begin with savings breakdown
- **Offer End Alerts**: Know when offers expire with duration tracking
- **Price Drop Alerts**: Significant price drops (>50%) trigger instant notifications
- **Notification Panel**: Click the clock icon to view all alerts with timestamps

### 📈 Offer Intelligence
- **Offer Duration Tracking**: See how long offers have been active or how long they lasted
- **Predictive Analytics**: System learns offer patterns and predicts when deals might return
- **Savings Targets**: Set a savings goal and visualize progress with an interactive chart
- **Historical Insights**: View complete offer lifecycle in product details

### 🔄 Automated Monitoring
- **Background Polling**: Automatically checks prices every 30 minutes with respectful rate limiting
- **SKU Fallback**: If a product URL changes, the system automatically searches by SKU to continue tracking
- **Local Persistence**: All tracked items, projects, and history are saved locally

### 🎨 Modern UI/UX
- **Clean Interface**: Built with a focus on usability and aesthetics, featuring Funnel Display typography
- **Detailed Views**: Click on any product to view high-resolution images, price breakdowns, offer information, and direct purchase links
- **Multiple Views**: Dashboard, History, and Help & FAQ pages

## 🤝 Respectful Web Scraping

aggregateDuka is designed to be respectful to Carrefour Kenya's servers:

- ⏱️ **2-4 second delay** before each request
- ⏱️ **3-5 second delay** between checking multiple products
- ⏱️ **15 minute minimum** interval between checks for the same product
- ⏱️ **30 minute background** polling cycle
- 🔀 **Randomized delays** to avoid predictable patterns
- 📉 **Graceful degradation** with proper error handling

This ensures minimal server load while still providing timely price updates.

## 🛠️ Built With
- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS 4**
- **Cheerio** (for robust web scraping)
- **Lucide React** (for beautiful iconography)
- **Funnel Display** (Google Fonts typography)
