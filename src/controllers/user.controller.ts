import { Request, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../Config/database";

export const createUser = async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
              message: "Username, email and password are required",
           });
        }

        if (!email.includes("@")) {
            return res.status(400).json({
                message: "Invalid email",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
            INSERT INTO users (username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, created_at
            `,
            [username, email, hashedPassword]
        );

        res.status(201).json({
            message: "User created successfully",
            user: result.rows[0],
        });
        } catch (error: any) {
        console.error(error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "Username or email already exists",
            });
        }

        res.status(500).json({
            message: "Failed to create user",
        });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT id, username, created_at
            FROM users
            WHERE id = $1
            `,
            [id]
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
            message: "Failed to fetch user",
        });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;

        const result = await pool.query(
            `
            SELECT id, username
            FROM users
            WHERE id <> $1
            ORDER BY LOWER(username) ASC, id ASC
            `,
            [currentUser.userId]
        );

        res.status(200).json({
            users: result.rows,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch users",
        });
    }
};