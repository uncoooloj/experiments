const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();
const pairs = {
    'CAKEUSDT': 'cakeusdt',
    'BTCUSDT': 'btcusdt',
    'ETHUSDT': 'ethusdt',
    'XRPUSDT': 'xrpusdt',
    'DOGEUSDT': 'dogeusdt',
    'SOLUSDT': 'solusdt',
    'ADAUSDT': 'adausdt',
    'DOTUSDT': 'dotusdt',
    'XLMUSDT': 'xlmusdt',
    'LINKUSDT': 'linkusdt',
}

class QuidaxDCABot {
    constructor(apiKey, secretKey, dcaAmount) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.dcaAmount = dcaAmount; // Amount in NGN
        this.baseUrl = 'https://www.quidax.com/api/v1';
        // this.market = 'cakeusdt'; // or appropriate market pair
    }

    generateSignature(method, path, body = '') {
        const timestamp = Date.now().toString();
        const payload = `${timestamp}${method}${path}${body}`;
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(payload)
            .digest('hex');
        
        return { signature, timestamp };
    }

    async makeRequest(method, endpoint, data = null) {
        const path = `/api/v1${endpoint}`;
        const { signature, timestamp } = this.generateSignature(method, path, JSON.stringify(data));

        try {
            const response = await axios({
                method: method,
                url: `${this.baseUrl}${endpoint}`,
                data: data,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    // 'ACCESS-KEY': this.apiKey,
                    // 'ACCESS-TIMESTAMP': timestamp,
                    // 'ACCESS-SIGN': signature,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`API Request Error: ${path}`, error.response?.data || error.message);
            throw error?.response?.data || error.message;
        }
    }

    async getCurrentPrice(pair) {
        try {
            const response = await this.makeRequest('GET', `/markets/tickers/${pair}`);
            return parseFloat(response.data.last_price);
        } catch (error) {
            console.error('Error fetching price:', error);
            throw error;
        }
    }

    async getAccountBalance() {
        try {
            const response = await this.makeRequest('GET', '/users/me');
            return response.data.accounts;
        } catch (error) {
            console.error('Error fetching balance:', error);
            throw error;
        }
    }

    async executeDCA(pair) {
        try {
            // 1. Get current CAKE price
            const currentPrice = await this.getCurrentPrice(pair);
            console.log('Current price:', currentPrice);
            
            // 2. Calculate quantity to buy based on DCA amount
            const quantity = (this.dcaAmount / currentPrice).toFixed(8);
            console.log('Quantity:', quantity);
            // 3. Place market buy order
            const orderData = {
                bid: pair,
                side: 'buy',
                type: 'market',
                volume: quantity
            };
            console.log('Order data:', orderData);
            const order = await this.makeRequest('POST', '/orders', orderData);

            console.log(`DCA Execute Success:
                Time: ${new Date().toISOString()}
                Amount: ${this.dcaAmount} NGN
                Quantity: ${quantity} CAKE
                Price: ${currentPrice} NGN`);
            console.log('Order:', order);
            return order;
        } catch (error) {
            console.error('Error executing DCA:', error);
            // Implement your error notification system here
            throw error;
        }
    }

    // Start DCA schedule (default: weekly)
    async startSchedule(pair, cronSchedule = '0 0 * * 0') {
        console.log('Starting DCA schedule for pair:', pair);
        await this.executeDCA(pair);
        // cron.schedule(cronSchedule, async () => {
        //     try {
        //         await this.executeDCA(pair);
        //     } catch (error) {
        //         console.error('Scheduled DCA failed:', error);
        //     }
        // });
        
        console.log('DCA schedule started');
    }
}

// Fix export syntax using CommonJS
function startBot() {
    // Load from environment variables
    const apiKey = process.env.QUIDAX_API_KEY;
    const secretKey = process.env.QUIDAX_SECRET_KEY;
    const dcaAmount = process.env.DCA_AMOUNT || 20000; // Default 20,000 NGN

    if (!apiKey || !secretKey) {
        console.error('Please set QUIDAX_API_KEY and QUIDAX_SECRET_KEY in .env file');
        process.exit(1);
    }

    const bot = new QuidaxDCABot(apiKey, secretKey, dcaAmount);
    
    // Start weekly DCA
    bot.startSchedule(pairs.BTCUSDT);
}

module.exports = startBot;

// Start the bot
// startBot();