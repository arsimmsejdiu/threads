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

export async function createThread({text, author, communityId, path}: Params) {
    try {
        connectToDB();

        const communityIdObject = await Community.findOne(
            {id: communityId},
            {_id: 1}
        )

        const createdThread = await Thread.create({
            text,
            author,
            community: communityIdObject
        });

        //Update User model
        await User.findByIdAndUpdate(author, {
            $push: { threads: createdThread._id}
        });

        if(communityIdObject) {
            // Update Community model
            await Community.findByIdAndUpdate(communityIdObject, {
                $push: {threads: createdThread._id}
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
      const postsQuery = Thread.find({ parentId: { $in: [null, undefined] }})
        .sort({createdAt: "desc"})
        .skip(skipAmount)
        .limit(pageSize)
        .populate({ path: "author", model: User})
        .populate({
             path: "children",
             populate: {
                path: "author",
                model: User,
                select: "_id name parentId image"
             }
        }) // diving into recurtion

        const totalPostCount = await Thread.countDocuments({ parentId: { $in: [null, undefined]}}) // we get only the top threads(only parents and not the coments)

        const posts = await postsQuery.exec();

        const isNext = totalPostCount > skipAmount + posts.length;// means that we do have a next page

        return {posts, isNext}
    } catch (error: any) {
        throw new Error(`Error fetching threads: ${error.message}`);
    }
}