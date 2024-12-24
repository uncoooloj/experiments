const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();
const PAIRS = {
    'CAKEUSDT': { pair: 'cakeusdt', coin: 'cake', market: 'CAKE', usdValue: 10 },
    'BTCUSDT': { pair: 'btcusdt', coin: 'btc', market: 'BTC', usdValue: 10 },
    'ETHUSDT': { pair: 'ethusdt', coin: 'eth', market: 'ETH', usdValue: 10 },
    'XRPUSDT': { pair: 'xrpusdt', coin: 'xrp', market: 'XRP', usdValue: 10 },
    'DOGEUSDT': { pair: 'dogeusdt', coin: 'doge', market: 'DOGE', usdValue: 10 },
    'SOLUSDT': { pair: 'solusdt', coin: 'sol', market: 'SOL', usdValue: 10 },
    'ADAUSDT': { pair: 'adausdt', coin: 'ada', market: 'ADA', usdValue: 10 },
    'DOTUSDT': { pair: 'dotusdt', coin: 'dot', market: 'DOT', usdValue: 10 },
    'XLMUSDT': { pair: 'xlmusdt', coin: 'xlm', market: 'XLM', usdValue: 10 },
    'LINKUSDT': { pair: 'linkusdt', coin: 'link', market: 'LINK', usdValue: 10 },
}

const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
}

const BASE_CURRENCY = 'usdt'

const TYPE = {
    BUY: 'buy',
    SELL: 'sell'
}

class QuidaxDCABot {
    constructor(apiKey, secretKey, dcaAmount) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.dcaAmount = dcaAmount; // Amount in NGN
        this.baseUrl = 'https://www.quidax.com/api/v1';
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
            const axiosData = {
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (method === HTTP_METHODS.POST || method === HTTP_METHODS.PUT) {
                axiosData.data = data;
            }
            console.log('axiosData:', axiosData);
            const response = await axios(axiosData);
            return response.data;
        } catch (error) {
            console.error(`API Request Error: ${path}`, error.response?.data || error.message);
            throw error?.response?.data || error.message;
        }
    }

    async getCurrentPrice(pair, type) {
        try {
            const response = await this.makeRequest('GET', `/markets/tickers/${pair}`);
            return parseFloat(response?.data?.ticker[type]);
        } catch (error) {
            console.error('Error fetching price:', error);
            throw error;
        }
    }

    //get quidax balance
    async getWalletBalance(currency = BASE_CURRENCY) {
        try {
            const response = await this.makeRequest('GET', `/users/me/wallets/${currency}`);
            const { status, message, data } = response;
            if (status == 'success') {
                return data?.balance;
            } else {
                throw message;
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
            throw error;
        }
    }

    async order(type, amount, ask) {
        try {
            let exData, unit;

            if (type == TYPE.BUY) {
                exData = { 'total': amount };
                unit = BASE_CURRENCY;
            } else if (type == TYPE.SELL) {
                exData = { 'volume': amount };
                unit = ask;
            } else {
                throw 'Invalid type';
            }


            let dataToSend = {
                'bid': BASE_CURRENCY,
                'ask': ask,
                'type': type ?? TYPE.BUY,
                'unit': unit,
                ...exData
            };

            console.log(`order :::`, JSON.stringify({ dataToSend }));

            const response = await this.makeRequest(HTTP_METHODS.POST, '/users/me/instant_orders', dataToSend);
            let { status, message, data } = response.data;
            console.log(`order response :::`, JSON.stringify({ request: { dataToSend }, response: { status, message, data } }));

            if (status == 'success') {
                return response.data;
            } else {
                return false;
            }
        } catch (e) {
            console.log(`order::Error: `, e);
            throw e;
        }
    }

    async confirmOrder(orderId) {
        try {
            console.log(`confirming order :::`, JSON.stringify({ orderId }));
            let response = await axios({
                method: 'post',
                url: `${process.env.QUIDAX_ENDPOINT}/api/${process.env.QUIDAX_VERSION}/users/${process.env.QUIDAX_USERID}/instant_orders/${orderId}/confirm`,
                headers: {
                    Authorization: `Bearer ${process.env.QUIDAX_SK}`
                }
            });


            let { status, message, data } = response.data;

            console.log(`confirming order response :::`, JSON.stringify({ request: { orderId }, response: { status, message, data } }));

            if (status == 'success') {
                return response.data;
            } else {
                return false;
            }
        } catch (e) {
            console.log(`confirmOrder::Error: `, e.message);
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

    async executeDCA(currencyPairData) {
        try {
            // Get current USDT balance
            const usdtBalance = await this.getWalletBalance('usdt');
            console.log('USDT balance:', usdtBalance);

            if (usdtBalance < currencyPairData.usdValue) {
                // throw 'Insufficient USDT balance';
            }

            // 1. Get current CAKE price
            const currentPrice = await this.getCurrentPrice(currencyPairData.pair, TYPE.BUY);
            console.log('Current price:', currentPrice);
            

            // 2. Order DCA amount
            const order = await this.order(TYPE.BUY, currencyPairData.usdValue, currencyPairData.coin);

            console.log(`DCA Execute Success:
                Time: ${new Date().toISOString()}
                Quantity: ${quantity} USDT
                Price: ${currentPrice} CAKE`);
            console.log('Order:', order);
            return order;
        } catch (error) {
            //nudge OJ to take action

            console.error('Error executing DCA:', error);
            // Implement your error notification system here
            throw error;
        }
    }

    // Start DCA schedule (default: weekly)
    async startSchedule(currencyPairData, cronSchedule = '0 0 * * 0') {
        console.log('Starting DCA schedule for currencyPairData:', currencyPairData);
        await this.executeDCA(currencyPairData);
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
async function startBot() {
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
    await bot.startSchedule(PAIRS.CAKEUSDT);
}

module.exports = startBot;

// Start the bot
// startBot();