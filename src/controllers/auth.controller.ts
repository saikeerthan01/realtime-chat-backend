import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../Config/database";
import dotenv from "dotenv";
dotenv.config();

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const result = await pool.query(
            `
            SELECT id, username, email, password_hash
            FROM users
            WHERE email = $1
            `,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            process.env.JWT_SECRET as string,
            {
                expiresIn: "1h",
            }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Login failed",
        });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        const result = await pool.query(
            `
            SELECT id, username, email, created_at
            FROM users
            WHERE id = $1
            `,
            [user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch profile",
        });
    }
};