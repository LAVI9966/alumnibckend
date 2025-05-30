const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Validate shipping address
const validateShippingAddress = (address) => {
    if (!address) return 'Shipping address is required';
    if (!address.name) return 'Name is required';
    if (!address.phone) return 'Phone is required';
    if (!address.address) return 'Address is required';
    if (!address.city) return 'City is required';
    if (!address.state) return 'State is required';
    if (!address.pincode) return 'PIN code is required';
    return null;
};

// Validate order items
const validateOrderItems = (items) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return 'Invalid items data';
    }

    for (const item of items) {
        if (!item.product) return 'Product ID is required for each item';
        if (!mongoose.Types.ObjectId.isValid(item.product)) {
            return `Invalid product ID: ${item.product}`;
        }
        if (!item.quantity || item.quantity < 1) {
            return 'Invalid quantity for item';
        }
        if (!item.price || item.price <= 0) {
            return 'Invalid price for item';
        }
    }

    return null;
};

// Create a new order
router.post('/', auth, async (req, res) => {
    try {
        const { items, shippingAddress } = req.body;

        // Log incoming data for debugging
        console.log('Received order data:', { items, shippingAddress });

        // Validate shipping address
        const addressError = validateShippingAddress(shippingAddress);
        if (addressError) {
            console.error('Invalid shipping address:', addressError);
            return res.status(400).json({ message: addressError });
        }

        // Validate order items
        const itemsError = validateOrderItems(items);
        if (itemsError) {
            console.error('Invalid order items:', itemsError);
            return res.status(400).json({ message: itemsError });
        }

        // Convert product IDs to ObjectIds
        const validItems = items.map(item => ({
            product: new mongoose.Types.ObjectId(item.product),
            quantity: item.quantity,
            price: item.price
        }));

        // Calculate total amount
        const totalAmount = validItems.reduce((total, item) => total + (item.price * item.quantity), 0);

        if (totalAmount <= 0) {
            console.error('Invalid total amount:', totalAmount);
            return res.status(400).json({ message: 'Invalid total amount' });
        }

        try {
            // Create Razorpay order
            const razorpayOrder = await razorpay.orders.create({
                amount: totalAmount * 100, // Razorpay expects amount in paise
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            });

            // Create order in database
            const order = new Order({
                razorpayOrderId: razorpayOrder.id,
                items: validItems,
                totalAmount,
                user: req.user.id,
                shippingAddress
            });

            await order.save();
            console.log('Order created successfully:', order._id);

            res.json({
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                orderDetails: {
                    id: order._id,
                    status: order.status,
                    totalAmount: order.totalAmount
                }
            });
        } catch (razorpayError) {
            console.error('Razorpay error:', razorpayError);
            return res.status(400).json({
                message: 'Payment gateway error',
                details: razorpayError.message
            });
        }
    } catch (error) {
        console.error('Error creating order:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation error',
                details: error.message
            });
        }
        res.status(500).json({
            message: 'Error creating order',
            details: error.message
        });
    }
});

// Verify payment
router.post('/verify', auth, async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ message: 'Missing payment verification data' });
        }

        // Verify signature
        const body = razorpayOrderId + "|" + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpaySignature;

        if (!isAuthentic) {
            console.error('Invalid signature for order:', razorpayOrderId);
            return res.status(400).json({ message: 'Invalid signature' });
        }

        // Update order status
        const order = await Order.findOne({ razorpayOrderId });
        if (!order) {
            console.error('Order not found:', razorpayOrderId);
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order belongs to user
        if (order.user.toString() !== req.user.id) {
            console.error('Unauthorized access attempt for order:', razorpayOrderId);
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Check if order is already completed
        if (order.status === 'completed') {
            return res.status(400).json({ message: 'Order already completed' });
        }

        // Update order with payment details
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.status = 'completed';

        try {
            await order.save();
            console.log('Order completed successfully:', razorpayOrderId);
            res.json({
                message: 'Payment verified successfully',
                orderId: order._id,
                status: order.status
            });
        } catch (saveError) {
            console.error('Error saving order:', saveError);
            return res.status(500).json({ message: 'Error updating order status' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Error verifying payment' });
    }
});

// Get user orders
router.get('/user', auth, async (req, res) => {
    try {
        console.log('Fetching orders for user:', req.user.id);

        // First check if user exists
        if (!req.user || !req.user.id) {
            console.error('No user found in request');
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Log the query we're about to execute
        console.log('Executing query:', { user: req.user.id });

        const orders = await Order.find({ user: req.user.id })
            .populate({
                path: 'items.product',
                select: 'name image price'
            })
            .sort({ createdAt: -1 });

        console.log('Raw orders from database:', JSON.stringify(orders, null, 2));

        if (!orders || orders.length === 0) {
            console.log('No orders found for user:', req.user.id);
            return res.json([]);
        }

        // Transform the data to ensure all required fields are present
        const transformedOrders = orders.map(order => {
            console.log('Processing order:', order._id);
            return {
                _id: order._id,
                status: order.status,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt,
                items: order.items.map(item => {
                    console.log('Processing item:', item._id, 'Product:', item.product);
                    return {
                        _id: item._id,
                        quantity: item.quantity,
                        price: item.price,
                        product: {
                            _id: item.product?._id,
                            name: item.product?.name || 'Product not found',
                            image: item.product?.image || '/images/default-product.png',
                            price: item.product?.price || 0
                        }
                    };
                }),
                shippingAddress: order.shippingAddress
            };
        });

        console.log('Transformed orders:', JSON.stringify(transformedOrders, null, 2));
        res.json(transformedOrders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({
            message: 'Error fetching orders',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get order status
router.get('/:orderId', auth, async (req, res) => {
    try {
        const order = await Order.findOne({ razorpayOrderId: req.params.orderId })
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if the order belongs to the authenticated user
        if (order.user._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// Admin routes
const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized' });
    }
    next();
};

// Get all orders (admin only)
router.get('/admin', auth, adminAuth, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({
                path: 'items.product',
                select: 'name image price'
            })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        const transformedOrders = orders.map(order => ({
            _id: order._id,
            status: order.status,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            items: order.items.map(item => ({
                _id: item._id,
                quantity: item.quantity,
                price: item.price,
                product: {
                    _id: item.product?._id,
                    name: item.product?.name || 'Product not found',
                    image: item.product?.image || '/images/default-product.png',
                    price: item.product?.price || 0
                }
            })),
            shippingAddress: order.shippingAddress,
            user: {
                _id: order.user._id,
                name: order.user.name,
                email: order.user.email
            }
        }));

        res.json(transformedOrders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({
            message: 'Error fetching orders',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update order status (admin only)
router.patch('/admin/:orderId/status', auth, adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = status;
        await order.save();

        res.json({
            message: 'Order status updated successfully',
            order: {
                _id: order._id,
                status: order.status
            }
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            message: 'Error updating order status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 