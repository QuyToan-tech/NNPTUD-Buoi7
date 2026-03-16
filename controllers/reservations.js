let reservationModel = require('../schemas/reservations');
let cartModel = require('../schemas/cart');
let productModel = require('../schemas/products');
let inventoryModel = require('../schemas/inventories');
let mongoose = require('mongoose');

module.exports = {
    getAllReservations: async function (userId) {
        return await reservationModel.find({ user: userId }).populate('items.product');
    },

    getReservationById: async function (userId, reservationId) {
        return await reservationModel.findOne({ _id: reservationId, user: userId }).populate('items.product');
    },

    reserveACart: async function (userId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            let cart = await cartModel.findOne({ user: userId }).populate('items.product').session(session);
            if (!cart || cart.items.length === 0) {
                throw new Error('Cart is empty');
            }

            let items = [];
            let totalAmount = 0;

            for (let item of cart.items) {
                let inventory = await inventoryModel.findOne({ product: item.product._id }).session(session);
                if (!inventory || inventory.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.product.title}`);
                }

                let subtotal = item.product.price * item.quantity;
                items.push({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: subtotal
                });
                totalAmount += subtotal;

                // Update inventory
                inventory.stock -= item.quantity;
                inventory.reserved += item.quantity;
                await inventory.save({ session });
            }

            let reservation = new reservationModel({
                user: userId,
                items: items,
                totalAmount: totalAmount,
                ExpiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });

            await reservation.save({ session });

            // Clear cart
            cart.items = [];
            await cart.save({ session });

            await session.commitTransaction();
            return reservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    },

    reserveItems: async function (userId, items) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            let reservationItems = [];
            let totalAmount = 0;

            for (let item of items) {
                let product = await productModel.findById(item.product).session(session);
                if (!product) {
                    throw new Error(`Product ${item.product} not found`);
                }

                let inventory = await inventoryModel.findOne({ product: item.product }).session(session);
                if (!inventory || inventory.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ${product.title}`);
                }

                let subtotal = product.price * item.quantity;
                reservationItems.push({
                    product: item.product,
                    quantity: item.quantity,
                    price: product.price,
                    subtotal: subtotal
                });
                totalAmount += subtotal;

                // Update inventory
                inventory.stock -= item.quantity;
                inventory.reserved += item.quantity;
                await inventory.save({ session });
            }

            let reservation = new reservationModel({
                user: userId,
                items: reservationItems,
                totalAmount: totalAmount,
                ExpiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });

            await reservation.save({ session });

            await session.commitTransaction();
            return reservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    },

    cancelReserve: async function (userId, reservationId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            let reservation = await reservationModel.findOne({ _id: reservationId, user: userId }).session(session);
            if (!reservation) {
                throw new Error('Reservation not found');
            }

            if (reservation.status !== 'actived') {
                throw new Error('Reservation cannot be cancelled');
            }

            for (let item of reservation.items) {
                let inventory = await inventoryModel.findOne({ product: item.product }).session(session);
                if (inventory) {
                    inventory.stock += item.quantity;
                    inventory.reserved -= item.quantity;
                    await inventory.save({ session });
                }
            }

            reservation.status = 'cancelled';
            await reservation.save({ session });

            await session.commitTransaction();
            return reservation;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
};