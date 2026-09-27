import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface AuthenticatedRequest extends Request {
    user?: string | jwt.JwtPayload;
}

export const authenticateToken = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    
    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access token required",
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string
        );

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired token",
        });
    }
};