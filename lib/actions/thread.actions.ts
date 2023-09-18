"use server"

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose"
import Community from "../models/community.model";

interface Params {
    text: string,
    author: string,
    communityId: string | null,
    path: string
}

export async function createThread({ text, author, communityId, path }: Params) {
    try {
        connectToDB();

        const communityIdObject = await Community.findOne(
            { id: communityId },
            { _id: 1 }
        )

        const createdThread = await Thread.create({
            text,
            author,
            community: communityIdObject
        });

        //Update User model
        await User.findByIdAndUpdate(author, {
            $push: { threads: createdThread._id }
        });

        if (communityIdObject) {
            // Update Community model
            await Community.findByIdAndUpdate(communityIdObject, {
                $push: { threads: createdThread._id }
            })
        }

        revalidatePath(path);
    } catch (error: any) {
        throw new Error(`Error creating thread: ${error.message}`)
    }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
    try {
        connectToDB();

        // Calculate the number of posts to skip 
        const skipAmount = (pageNumber - 1) * pageSize;

        // Fetch posts that has no parents (top-level threads ... ) we don't want to find comments only real threads
        const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
            .sort({ createdAt: "desc" })
            .skip(skipAmount)
            .limit(pageSize)
            .populate({ path: "author", model: User })
            .populate({
                path: "children",
                populate: {
                    path: "author",
                    model: User,
                    select: "_id name parentId image"
                }
            }) // diving into recurtion

        const totalPostCount = await Thread.countDocuments({ parentId: { $in: [null, undefined] } }) // we get only the top threads(only parents and not the coments)

        const posts = await postsQuery.exec();

        const isNext = totalPostCount > skipAmount + posts.length;// means that we do have a next page

        return { posts, isNext }
    } catch (error: any) {
        throw new Error(`Error fetching threads: ${error.message}`);
    }
}

export async function fetchThreadById(id: string) {
    try {
        connectToDB();

        //TODO: populate community
        const thread = await Thread.findById(id)
            .populate({
                path: "author",
                model: User,
                select: "_id id name image"
            })
            .populate({
                path: "children",
                populate: [
                    {
                        path: "author",
                        model: User,
                        select: "_id id name parentId image"
                    },
                    {
                        path: "children",
                        model: Thread,
                        populate: {
                            path: "author",
                            model: User,
                            select: "_id id name parentId image"
                        }
                    }
                ]
            }).exec();

        return thread;
    } catch (error: any) {
        throw new Error(`Error geting thread details: ${error.message}`)
    }
}

export async function addCommentToThread(
    threadId: string,
    commentText: string,
    userId: string,
    path: string
) {
    try {
        //Connect to MongoDB
        connectToDB();

        // Find the original thread by its id
        const originalThread = await Thread.findById(threadId);
        if (!originalThread) {
            throw new Error("Thread not found");
        }

        //Create a new thread with the comment text
        const commentThread = new Thread({
            text: commentText,
            author: userId,
            parentId: threadId
        });

        //Save the new thread
        const savedCommentThread = await commentThread.save();

        //update the original to include the new comment
        originalThread.children.push(savedCommentThread._id);

        //Save the original thread
        await originalThread.save();

        revalidatePath(path);
    } catch (error: any) {
        throw new Error(`Error adding comment to thread: ${error.message}`)
    }
}