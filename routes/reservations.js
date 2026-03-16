var express = require('express');
var router = express.Router();
let { checkLogin } = require('../utils/authHandler.js');
let reservationController = require('../controllers/reservations');

router.get('/', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservations = await reservationController.getAllReservations(userId);
        res.json(reservations);
    } catch (error) {
        next(error);
    }
});

router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservationId = req.params.id;
        let reservation = await reservationController.getReservationById(userId, reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }
        res.json(reservation);
    } catch (error) {
        next(error);
    }
});

router.post('/reserveACart', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservation = await reservationController.reserveACart(userId);
        res.json(reservation);
    } catch (error) {
        next(error);
    }
});

router.post('/reserveItems', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let { items } = req.body; // items: [{ product: id, quantity: number }]
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Items must be an array' });
        }
        let reservation = await reservationController.reserveItems(userId, items);
        res.json(reservation);
    } catch (error) {
        next(error);
    }
});

router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservationId = req.params.id;
        let reservation = await reservationController.cancelReserve(userId, reservationId);
        res.json(reservation);
    } catch (error) {
        next(error);
    }
});

module.exports = router;