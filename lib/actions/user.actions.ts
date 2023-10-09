"use server"

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose"
import Community from "../models/community.model";
import Thread from "../models/thread.model";

interface UpdateUserProps {
    userId: string,
    username: string,
    name: string,
    bio: string,
    image: string,
    path: string
}

export async function updateUser({ userId, username, name, bio, image, path }: UpdateUserProps): Promise<void> {
    try {
        connectToDB();
        await User.findOneAndUpdate(
            { id: userId },
            {
                username: username.toLowerCase(),
                name,
                bio,
                image,
                onboarded: true,
            },
            { upsert: true } // upsert "update" and "insert" -> is a database operation that will update an existing row if a specified value already exist in a table
            // -> and insert a new row if a specified value doesn't exist
        );

        if (path === "/profile/edit") {
            revalidatePath(path); // -> Allows you to revalidate data associated with specific path. This is useful for scenarios where you want 
            // -> to update your cached data without waiting for a revalidation data to expire
        }
    } catch (error: any) {
        throw new Error(`Failed to create/update user: ${error.message}`);
    }
}

export async function fetchUser(userId: string) {
    try {
        connectToDB();
        return await User
            .findOne({ id: userId })
            .populate({
                path: "communities",
                model: Community,
            });
    } catch (error: any) {
        throw new Error(`Failed to fetch user: ${error.message}`);
    }
}

export async function fetchUserPosts(userId: string) {
    try {
        connectToDB();
        // Find all threads authored by user with the given userId
        //TODO: populate comunity
        const threads = await User.findOne({ id: userId })
            .populate({
                path: "threads",
                model: Thread,
                populate: {
                    path: "children",
                    model: Thread,
                    populate: {
                        path: "author",
                        model: User,
                        select: "name image id"
                    }
                }
            });
            
        return threads;
    } catch (error: any) {
        throw new Error(`Failed to fetch user posts: ${error.message}`);
    }
}