import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { WAITING_LIST_STATUS } from "./constants";

export const getQueuePosition = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async ( ctx, { eventId, userId }) => {
    // get entry for this specific user and event combination
    const entry  = await ctx.db
      .query("waitingList")
      .withIndex("by_user_event", (q)=>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .filter((q) => q.neq(q.field("status"), WAITING_LIST_STATUS.EXPIRED))
      .first();

    if(!entry) return null;
    
    // get total number of people ahead in line
    const peopleAhead = await ctx.db
      .query("waitingList")
      .withIndex("by_event_status", (q)=>q.eq("eventId", eventId))
      .filter((q) => 
        q.and(
          // get all entries before this one 
          q.lt(q.field("_creationTime"), entry._creationTime),
          // only get entries that are either waiting or offered
          q.or(
            q.eq(q.field("status"), WAITING_LIST_STATUS.WAITING),
            q.eq(q.field("status"), WAITING_LIST_STATUS.OFFERED)
          )
        )
      )
      .collect()
      .then((entries)=> entries.length);

    return {
      ...entry,
      position: peopleAhead + 1,
    };
  },
})

export const releaseTicket = mutation({
  args: {
    eventId: v.id("events"),
    waitingListId: v.id("waitingList"),
  },
  handler: async (ctx, { eventId, waitingListId }) => {
    const entry = await ctx.db.get(waitingListId);

    if(!entry || entry.status !== WAITING_LIST_STATUS.OFFERED){
      throw new Error("No valid ticket offer found");
    }

    // mark the entry expired 
    await ctx.db.patch(waitingListId, {
      status: WAITING_LIST_STATUS.EXPIRED
    })

    // process the queue to offer ticket to the next person
    // await processQueue(ctx, { eventId })

  }
})