"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
const healthCheck = (req, res) => {
    res.json({
        status: "OK",
        message: "Chat backend is healthy"
    });
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=health.controller.js.map