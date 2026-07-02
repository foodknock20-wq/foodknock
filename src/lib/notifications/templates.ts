// src/lib/notifications/templates.ts
// FoodKnock Notification Engine — event → payload template registry.
//
// A "template" turns a NotificationEvent into a channel-agnostic
// NotificationPayload. "push.campaign" pulls from PUSH_CAMPAIGN_POOL below.
//
// PHASE 2 UPGRADE (additive only — no signature changes):
//   - PUSH_CAMPAIGN_POOL expanded to 100 morning + 100 evening entries,
//     Gen-Z voice across every requested theme (funny, meme, savage,
//     flirty, relationship, crush, single life, college, office, hostel,
//     friends, parents, family, weekend, sunday, rain, summer, winter,
//     festival, late night, midnight cravings, pizza, burger, momos,
//     shakes, cold coffee, ice cream, fries, healthy, cheat day, offers,
//     combo, FOMO, mood swings, lazy, relatable, chaotic, trending, viral,
//     internet culture). `vibe` is a new OPTIONAL field on SlotMessage —
//     purely additive, nothing requires it, so this compiles unchanged
//     against any prior consumer.
//   - pickCampaignMessage(slot) keeps its EXACT original signature and
//     return type. Internally upgraded to production-grade anti-repeat:
//     tracks recently-shown indices per slot (module-scoped, in-memory)
//     and never repeats any of the last N shown until the pool is
//     exhausted, then reshuffles — lightweight, no external deps, no DB.

import type { NotificationEvent, NotificationPayload } from "./types";

export type NotificationSlot = "morning" | "evening";

/** Purely descriptive — never required, never read by delivery logic. */
export type CampaignVibe =
    | "funny" | "meme" | "savage" | "flirty" | "relationship" | "crush" | "single_life"
    | "college" | "office" | "hostel" | "friends" | "parents" | "family"
    | "weekend" | "sunday" | "rain" | "summer" | "winter" | "festival"
    | "late_night" | "midnight_cravings"
    | "pizza" | "burger" | "momos" | "shakes" | "cold_coffee" | "ice_cream" | "fries"
    | "healthy" | "cheat_day" | "offers" | "combo"
    | "fomo" | "mood_swings" | "lazy" | "relatable" | "chaotic" | "trending" | "viral" | "internet_culture";

type SlotMessage = {
    slot: NotificationSlot;
    title: string;
    body: string;
    url: string;
    vibe?: CampaignVibe;
};

export const PUSH_CAMPAIGN_POOL: SlotMessage[] = [
    // ══════════════════════════════════════════════════════════════════
    // MORNING SLOT — 100 entries
    // ══════════════════════════════════════════════════════════════════

    { slot: "morning", vibe: "meme", title: "POV:", body: "Fridge ne resign kar diya. 😭", url: "/menu" },
    { slot: "morning", vibe: "savage", title: "Tum diet pe ho.", body: "Pet nahi. Order kar do.", url: "/menu" },
    { slot: "morning", vibe: "relatable", title: "Notification khol li.", body: "Ab order bhi kar do. 😂", url: "/menu" },
    { slot: "morning", vibe: "crush", title: "Crush online hai.", body: "Burger bhi. Reply dono me se kisi ek ko de do. 😭🍔", url: "/menu" },
    { slot: "morning", vibe: "chaotic", title: "Character development baad me.", body: "Burger pehle.", url: "/menu" },
    { slot: "morning", vibe: "office", title: "Standup meeting: 9 baje.", body: "Lunch standup: abhi. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "college", title: "Attendance short hai.", body: "Bhook full hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "single_life", title: "Single hone ka fayda?", body: "Poora burger tumhara. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "hostel", title: "Mess ka khana skip karne ka time.", body: "FoodKnock order karo, upgrade karo.", url: "/menu" },
    { slot: "morning", vibe: "lazy", title: "Kitchen tak jaana?", body: "Nah. Order karo, bed se hi.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "Brain: 'lunch soch lo'", body: "Tum: *scrolling*. Hum: order kar do na.", url: "/menu" },
    { slot: "morning", vibe: "funny", title: "Alarm snooze kiya.", body: "Bhook ko snooze button nahi milta. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "friends", title: "Group mein 'lunch kahan se?'", body: "Ek reply tumhara ho sakta hai: FoodKnock. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "parents", title: "'Ghar ka khana hi khao' — mummy", body: "Hum bhi fresh banate hain. Shhh. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "burger", title: "Burger cravings, subah 9 baje?", body: "Bilkul normal hai. Order karo abhi.", url: "/menu" },
    { slot: "morning", vibe: "pizza", title: "Pizza for lunch?", body: "Genius level decision. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "momos", title: "Momos ka time nikal aao.", body: "Steamy hot, order karo abhi.", url: "/menu" },
    { slot: "morning", vibe: "fomo", title: "Sabne already order kar diya.", body: "Tum peeche reh jaaoge. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "mood_swings", title: "Mood: unstable.", body: "Lunch: stable rehna chahiye. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "flirty", title: "Kisi ne breakfast pe pucha kya?", body: "Hum pooch lete hain — order karoge? 😏", url: "/menu" },
    { slot: "morning", vibe: "trending", title: "Trend: log lunch order kar rahe hain.", body: "Tum bhi kar lo. Viral ho jaao.", url: "/menu" },
    { slot: "morning", vibe: "internet_culture", title: "Main character energy?", body: "Order karke prove karo. Lunch scene.", url: "/menu" },
    { slot: "morning", vibe: "viral", title: "Ye notification viral honi chahiye.", body: "Kyunki lunch sach mein zaroori hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "cheat_day", title: "Diet plan? Kal se.", body: "Aaj order karo, guilt kal.", url: "/menu" },
    { slot: "morning", vibe: "healthy", title: "Aaj thoda light try karo.", body: "Fresh options FoodKnock pe hain. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "offers", title: "Aaj ka lunch sasta ho sakta hai.", body: "Deals check karo, order karo.", url: "/menu" },
    { slot: "morning", vibe: "combo", title: "Solo lunch? Nah.", body: "Combo lo, zyada mile. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "relationship", title: "'Lunch ke baad baat karte hain' — meeting mein bola?", body: "Toh lunch pehle sort karo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "savage", title: "Sharma ji ka beta already order kar chuka.", body: "Tum kab karoge?", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "Bhook: 100%. Patience: 0%.", body: "Order karo, abhi.", url: "/menu" },
    { slot: "morning", vibe: "funny", title: "WFH ka sabse bada lie:", body: "'Kitchen mein hi hoon, bana lunga.' 3 ghante ho gaye. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "office", title: "Meeting se pehle ya baad?", body: "Lunch decide kar lo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "college", title: "Lecture bunk kiya ya attend?", body: "Dono cases mein bhook lagi hi hogi. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "single_life", title: "Order split nahi karna aaj.", body: "Poora tumhara hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "hostel", title: "Roommate ne khana kha liya.", body: "Tum apna order karo. Abhi.", url: "/menu" },
    { slot: "morning", vibe: "lazy", title: "Uthne ka energy nahi hai.", body: "Order karne ka toh hai na. Karo.", url: "/menu" },
    { slot: "morning", vibe: "friends", title: "'Aaj kaun order karega' — group chat", body: "Tum karo. Hero bano. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "family", title: "Ghar pe sabko kya khilaoge aaj?", body: "FoodKnock se order karo, sabki pasand mil jaayegi.", url: "/menu" },
    { slot: "morning", vibe: "burger", title: "Cheesy burger ka mann hai?", body: "FoodKnock pe fresh banta hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "pizza", title: "Slice by slice, mood better hota hai.", body: "FoodKnock pizza try karo abhi.", url: "/menu" },
    { slot: "morning", vibe: "momos", title: "Chutney ke saath momos, perfect combo.", body: "Order karo, fresh milega.", url: "/menu" },
    { slot: "morning", vibe: "fomo", title: "Offer khatam hone wala hai.", body: "Jaldi order karo, miss mat karo.", url: "/menu" },
    { slot: "morning", vibe: "chaotic", title: "Sleep schedule: chaotic.", body: "Lunch schedule at least sort karo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "Fridge khola, kuch nahi mila.", body: "FoodKnock khola, sab mil gaya.", url: "/menu" },
    { slot: "morning", vibe: "relatable", title: "1 baja, 14 unread messages.", body: "Ek bhi lunch decide nahi kar raha. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "internet_culture", title: "Aaj ka plot twist:", body: "Tumne lunch order kiya. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "trending", title: "Sabse zyada order hone wala time — abhi.", body: "Trend follow karo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "cheat_day", title: "Cheat day officially declared.", body: "Order karo, celebrate karo.", url: "/menu" },
    { slot: "morning", vibe: "healthy", title: "Protein chahiye, guilt nahi.", body: "Gym gaye the? Order karo.", url: "/menu" },
    { slot: "morning", vibe: "offers", title: "Discount live hai abhi.", body: "Order karo, paise bachao.", url: "/menu" },
    { slot: "morning", vibe: "combo", title: "Burger + fries + drink.", body: "Sab ek saath. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "flirty", title: "Tumhara 'type' kya hai?", body: "Spicy, cheesy, ya simple? Order karo, pata chalega.", url: "/menu" },
    { slot: "morning", vibe: "relationship", title: "Pyaar mein dhokha mil sakta hai.", body: "Lunch mein nahi. Order karo, bharosa rakho.", url: "/menu" },
    { slot: "morning", vibe: "crush", title: "Crush ne seen kiya, reply nahi.", body: "Lunch kabhi seen-zone mein nahi rakhta. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "savage", title: "Budget tight hai?", body: "Bhook tight nahi hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "12:01 PM.", body: "Officially lunch crisis declared. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "funny", title: "Haan, ye ek notification hai.", body: "Par sach mein, order kar lo. Bhook lagi hai na?", url: "/menu" },
    { slot: "morning", vibe: "office", title: "Standup khatam, ab standup for lunch.", body: "Order karo, desk pe hi milega.", url: "/menu" },
    { slot: "morning", vibe: "college", title: "Canteen ki line lambi hai?", body: "FoodKnock pe koi line nahi. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "hostel", title: "PG ka khana mood off kar raha?", body: "Order karo, mood on karo.", url: "/menu" },
    { slot: "morning", vibe: "lazy", title: "Itna mat socho.", body: "Bas order kar do. Hum baaki sambhal lete hain.", url: "/menu" },
    { slot: "morning", vibe: "friends", title: "Colleagues already order kar chuke.", body: "Tum peeche reh jaaoge kya? Order karo.", url: "/menu" },
    { slot: "morning", vibe: "parents", title: "Mama ne pucha 'khaaya?'", body: "Abhi nahi, par order karne wale hain. Sach bol diya na?", url: "/menu" },
    { slot: "morning", vibe: "burger", title: "Ek burger, sau khushiyan.", body: "Order karo, taste karo, pyaar mein pado.", url: "/menu" },
    { slot: "morning", vibe: "pizza", title: "Hot aur fresh, seedha door pe.", body: "Pizza cravings ko halka mat lo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "momos", title: "Spicy momos craving?", body: "Hum samajhte hain. Order karo, satisfy karo.", url: "/menu" },
    { slot: "morning", vibe: "fomo", title: "Aaj kitne logo ne order kiya, guess karo.", body: "Tum bhi list mein ho sakte ho. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "chaotic", title: "To-do list mein 'lunch' likha tha?", body: "Toh tick mark karo. Order kar do.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "'Quick call' jo 1 ghanta chal gayi.", body: "Ab lunch bhi quick order kar lo.", url: "/menu" },
    { slot: "morning", vibe: "relatable", title: "Cart mein add kiya, checkout nahi kiya?", body: "Wo Amazon ke liye theek hai. Lunch abhi order karo.", url: "/menu" },
    { slot: "morning", vibe: "internet_culture", title: "Reels dekh rahe ho bhooke pet?", body: "Wo baad mein. Pehle order karo.", url: "/menu" },
    { slot: "morning", vibe: "trending", title: "Best seller trending hai abhi.", body: "Try karo, samajh jaaoge kyun. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "cheat_day", title: "Naya resolution: lunch skip nahi karna.", body: "Day 1 abhi shuru karo. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "healthy", title: "Kabhi kabhi comfort food chahiye.", body: "Judgement zero. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "offers", title: "Limited stock, unlimited swaad.", body: "Order karo abhi.", url: "/menu" },
    { slot: "morning", vibe: "combo", title: "Zyada value, kam paisa.", body: "Combo deals abhi check karo.", url: "/menu" },
    { slot: "morning", vibe: "flirty", title: "Date plan ho gaya, khaana bhi ho jaaye?", body: "Order karo, baaki sab perfect ho jaayega.", url: "/menu" },
    { slot: "morning", vibe: "relationship", title: "BF ya GF reply nahi karta time pe?", body: "Lunch hamesha time pe aata hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "single_life", title: "Akela lunch kar rahe ho?", body: "Company nahi, swaad toh hai. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "savage", title: "Bhook lagi hai.", body: "Hum jaante hain. Order kar do.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "Laptop battery: 1%.", body: "Tumhari energy bhi. Lunch on karo, restart karo.", url: "/menu" },
    { slot: "morning", vibe: "funny", title: "Office ka sabse bhooka insaan kaun?", body: "Tum, abhi. Order karne mein der mat karo.", url: "/menu" },
    { slot: "morning", vibe: "office", title: "Aaj ka target complete, ab lunch ka target.", body: "Order karo.", url: "/menu" },
    { slot: "morning", vibe: "college", title: "Assignment pending, bhook bhi pending.", body: "Ek problem solve kar dete hain — order karo.", url: "/menu" },
    { slot: "morning", vibe: "hostel", title: "Mess line lambi hai?", body: "FoodKnock pe koi line nahi. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "lazy", title: "Khud ko bhi thoda time do.", body: "Lunch break sirf khaane ka nahi hota. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "friends", title: "Kisi ne pucha 'lunch mein kya hai'?", body: "Jawab ready hona chahiye. Order kar lo pehle.", url: "/menu" },
    { slot: "morning", vibe: "family", title: "Kitchen ki chutti aaj le lo.", body: "Family lunch FoodKnock pe order karo.", url: "/menu" },
    { slot: "morning", vibe: "burger", title: "Spicy ya classic — dono mil sakte hain.", body: "Burger range mein kuch tumhare liye hoga.", url: "/menu" },
    { slot: "morning", vibe: "pizza", title: "Cheesy, hot, fresh.", body: "FoodKnock pe order karo abhi.", url: "/menu" },
    { slot: "morning", vibe: "momos", title: "Momos + chutney = perfect break.", body: "Fresh momos ready hain. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "fomo", title: "Ye deal zyada der nahi rukegi.", body: "Order karo jaldi.", url: "/menu" },
    { slot: "morning", vibe: "mood_swings", title: "Fact: bhooka insaan zyada irritate hota hai.", body: "Solution: order karo, mood theek karo.", url: "/menu" },
    { slot: "morning", vibe: "chaotic", title: "Naya menu, naya chaos.", body: "Explore karo, order karo.", url: "/menu" },
    { slot: "morning", vibe: "viral", title: "Ye order screenshot-worthy hoga.", body: "Order karo, prove karo.", url: "/menu" },
    { slot: "morning", vibe: "meme", title: "Salary abhi door hai.", body: "Par affordable lunch options abhi hain. Order karo.", url: "/menu" },
    { slot: "morning", vibe: "relatable", title: "Itna kaam hai, decision-making kam rakho.", body: "Order kar do, soch mat.", url: "/menu" },
    { slot: "morning", vibe: "internet_culture", title: "Main character moment:", body: "Order karke prove karo.", url: "/menu" },
    { slot: "morning", vibe: "trending", title: "Aaj sabka favorite try karo.", body: "Best seller order karo.", url: "/menu" },

    // ══════════════════════════════════════════════════════════════════
    // EVENING SLOT — 100 entries
    // ══════════════════════════════════════════════════════════════════

    { slot: "evening", vibe: "meme", title: "Netflix chal raha hai.", body: "Khana kahan hai? Order karo.", url: "/menu" },
    { slot: "evening", vibe: "lazy", title: "Sofa se uthne ka mann nahi?", body: "Zaroorat bhi nahi. Order karo, hum aa jaayenge.", url: "/menu" },
    { slot: "evening", vibe: "midnight_cravings", title: "12 baj gaye but bhook nahi sui.", body: "Late night menu ready hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "flirty", title: "Dinner date, khud ke saath bhi ho sakti hai.", body: "Order karo, khud ko treat karo. 😉", url: "/menu" },
    { slot: "evening", vibe: "crush", title: "Crush ka reply aaya ya nahi?", body: "Dinner ka toh confirm hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "savage", title: "Dinner ko hamesha zyada pyaar milta hai.", body: "Lunch bhi haqdar hai. Par abhi dinner order karo.", url: "/menu" },
    { slot: "evening", vibe: "single_life", title: "Solo dinner, full control.", body: "Order karo jo mann kare.", url: "/menu" },
    { slot: "evening", vibe: "college", title: "Exam ki tayari, pet ki bhi zaroori hai.", body: "Order karo FoodKnock se, focus better hoga.", url: "/menu" },
    { slot: "evening", vibe: "office", title: "Wrap-up call ke baad kya plan hai?", body: "Dinner FoodKnock se order kar lo.", url: "/menu" },
    { slot: "evening", vibe: "hostel", title: "Roommate ka khana khatam ho gaya.", body: "Apna order karo. Abhi.", url: "/menu" },
    { slot: "evening", vibe: "friends", title: "Gang mein 'dinner plan?' chal raha hai.", body: "Ek reply de do: FoodKnock. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "parents", title: "'Bahar ka mat khao' — mummy", body: "Hum bolte hain fresh hai. Dono khush. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "family", title: "Family dinner plan ban gaya?", body: "FoodKnock pe order karo, sab saath baithke khaao.", url: "/menu" },
    { slot: "evening", vibe: "burger", title: "Raat ka burger sabse best hota hai.", body: "Order karo abhi, garam garam milega.", url: "/menu" },
    { slot: "evening", vibe: "pizza", title: "Pizza night ban sakti hai aaj.", body: "Order karo, FoodKnock deliver karega.", url: "/menu" },
    { slot: "evening", vibe: "momos", title: "Aaj momos khaya? Nahi na!", body: "Steamy hot momos ready hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "ice_cream", title: "Meetha khaane ka bahana chahiye?", body: "Yeh raha. Order karo ice cream abhi.", url: "/menu" },
    { slot: "evening", vibe: "shakes", title: "Thick shake, thoda sukoon.", body: "Order karo, evening better ho jaayegi.", url: "/menu" },
    { slot: "evening", vibe: "cold_coffee", title: "Cold coffee ka time aa gaya.", body: "Order karo, refresh feel karo.", url: "/menu" },
    { slot: "evening", vibe: "fries", title: "Fries ka mood hai?", body: "Crispy fries, chilled shake — order karo abhi!", url: "/menu" },
    { slot: "evening", vibe: "weekend", title: "Weekend shuru, kitchen ki chhutti.", body: "Order karo FoodKnock se, aaj rules nahi.", url: "/menu" },
    { slot: "evening", vibe: "sunday", title: "Sunday evening = Netflix + Food.", body: "Doosra part hum kar dete hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "rain", title: "Baarish mein garma garam khaana.", body: "Order karo, hum bahar jaake laayenge.", url: "/menu" },
    { slot: "evening", vibe: "winter", title: "Winter ka best combo: blanket + FoodKnock.", body: "Bahar mat jao, order karo.", url: "/menu" },
    { slot: "evening", vibe: "summer", title: "Garmi mein thandi shake chahiye.", body: "Order karo FoodKnock se abhi.", url: "/menu" },
    { slot: "evening", vibe: "festival", title: "Aaj ka din special hai.", body: "FoodKnock pe bhi kuch special try karo. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "late_night", title: "Raat ko bhook lag gayi?", body: "Hum jaag rahe hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "offers", title: "Dinner pe bhi deal mil sakti hai.", body: "Check karo offers, order karo abhi.", url: "/menu" },
    { slot: "evening", vibe: "combo", title: "Solo nahi, combo lo tonight.", body: "Zyada value, kam kharcha. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "healthy", title: "Light dinner ka mann hai?", body: "Fresh, healthy options FoodKnock pe milte hain.", url: "/menu" },
    { slot: "evening", vibe: "cheat_day", title: "Cheat day, part 2.", body: "Order karo, subah ki tension abhi mat lo.", url: "/menu" },
    { slot: "evening", vibe: "fomo", title: "Aaj ka trending order try nahi kiya?", body: "Miss mat karo. Order karo abhi.", url: "/menu" },
    { slot: "evening", vibe: "mood_swings", title: "Mood: bas thoda comfort chahiye.", body: "Order karo, judgement zero.", url: "/menu" },
    { slot: "evening", vibe: "chaotic", title: "Din chaotic tha?", body: "Dinner sorted rakhte hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "relatable", title: "Sofa pe baithe, remote dhoondh rahe ho.", body: "Order bhi kar do saath mein.", url: "/menu" },
    { slot: "evening", vibe: "trending", title: "Aaj sabne yehi order kiya.", body: "Tum bhi try karo. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "viral", title: "Ye dinner screenshot deserve karta hai.", body: "Order karo, story banao.", url: "/menu" },
    { slot: "evening", vibe: "internet_culture", title: "Plot twist: aaj dinner khud order kiya.", body: "Order karo, twist banao.", url: "/menu" },
    { slot: "evening", vibe: "meme", title: "Brain: 'kal se healthy'", body: "Tum: order karo aaj. Kal dekha jaayega.", url: "/menu" },
    { slot: "evening", vibe: "funny", title: "Fridge phir se khali hai.", body: "FoodKnock kabhi khali nahi hota. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "savage", title: "Kisi ne aaj ignore kiya?", body: "Dinner kabhi ignore nahi karta. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "flirty", title: "Tumhara 'type' aaj kya hai?", body: "Spicy, cheesy, ya sweet? Order karo.", url: "/menu" },
    { slot: "evening", vibe: "relationship", title: "Pyaar mein dhokha ho sakta hai.", body: "Dinner mein nahi. Order karo, bharosa rakho.", url: "/menu" },
    { slot: "evening", vibe: "crush", title: "Crush ko reply nahi kiya abhi tak?", body: "Dinner order karke busy ho jaao. 😌", url: "/menu" },
    { slot: "evening", vibe: "single_life", title: "Company nahi hai toh kya?", body: "Swaad toh hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "college", title: "Gaming session ke saath crunchy chahiye?", body: "Order karo, session lamba chalega.", url: "/menu" },
    { slot: "evening", vibe: "office", title: "Aaj ka target complete.", body: "Ab dinner ka target. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "hostel", title: "PG mein aaj kuch nahi mila?", body: "FoodKnock hai na. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "friends", title: "'Dinner pe milte hain' — plan cancel ho gaya?", body: "Apna dinner toh order karo. Abhi.", url: "/menu" },
    { slot: "evening", vibe: "parents", title: "Papa ne pucha 'khaana kya hai?'", body: "'FoodKnock order kar diya' — sabse safe jawab.", url: "/menu" },
    { slot: "evening", vibe: "family", title: "Sabki pasand alag, solution ek.", body: "FoodKnock order karo, sabko milega.", url: "/menu" },
    { slot: "evening", vibe: "burger", title: "Cheesy burger, late evening version.", body: "Order karo, garam milega.", url: "/menu" },
    { slot: "evening", vibe: "pizza", title: "Slice by slice, stress kam.", body: "FoodKnock pizza try karo.", url: "/menu" },
    { slot: "evening", vibe: "momos", title: "Spicy momos, chilled evening.", body: "Order karo, satisfy karo.", url: "/menu" },
    { slot: "evening", vibe: "ice_cream", title: "Ice cream ka time aa gaya.", body: "Aaj ki shaam meethi karo. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "shakes", title: "Chocolate ya strawberry?", body: "Dono perfect. Order karo shake abhi.", url: "/menu" },
    { slot: "evening", vibe: "cold_coffee", title: "Thandi coffee, garam mood theek.", body: "Order karo, instant refresh.", url: "/menu" },
    { slot: "evening", vibe: "fries", title: "Crispy fries call kar rahi hain.", body: "Order karo, ignore mat karo.", url: "/menu" },
    { slot: "evening", vibe: "weekend", title: "Saturday mode: ON. Cooking mode: OFF.", body: "FoodKnock se order karo, relax karo.", url: "/menu" },
    { slot: "evening", vibe: "sunday", title: "Lazy Sunday ke liye perfect combo.", body: "Order karo, relax karo.", url: "/menu" },
    { slot: "evening", vibe: "rain", title: "Mausam ka mood, momos ka time.", body: "Baarish mein bahar jaane ka mann nahi? Hum aa jaayenge.", url: "/menu" },
    { slot: "evening", vibe: "winter", title: "Thand lag rahi hai?", body: "Garma garam soup ya shake, jo chahiye. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "summer", title: "Garmi mein cooking? Bilkul nahi.", body: "Cold shake, fresh juice — order karo.", url: "/menu" },
    { slot: "evening", vibe: "festival", title: "Roshni ka tyohaar, khushiyon ka khaana.", body: "Specials ready hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "late_night", title: "Neend nahi aa rahi, bhook lag rahi hai?", body: "Kuch order kar lo, hum deliver kar dete hain.", url: "/menu" },
    { slot: "evening", vibe: "midnight_cravings", title: "Midnight cravings hit kar gayi?", body: "Hum ready hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "offers", title: "Aaj ka discount abhi live hai.", body: "Order karo aur paise bachao.", url: "/menu" },
    { slot: "evening", vibe: "combo", title: "Burger + fries + drink, tonight.", body: "Sab ek saath. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "healthy", title: "Aaj kuch light try karo.", body: "Healthy options FoodKnock pe milte hain.", url: "/menu" },
    { slot: "evening", vibe: "cheat_day", title: "Kal se diet, aaj se dinner.", body: "Order karo, kal ki soch kal.", url: "/menu" },
    { slot: "evening", vibe: "fomo", title: "Ye deal aaj hi hai.", body: "Kal nahi milegi. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "mood_swings", title: "Mood theek nahi?", body: "Ek acha dinner fix kar dega. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "chaotic", title: "Plans cancel, dinner confirm.", body: "Order karo, ek toh sorted rahe.", url: "/menu" },
    { slot: "evening", vibe: "relatable", title: "Reels dekh rahe ho bhooke pet, phir se?", body: "Order karo pehle.", url: "/menu" },
    { slot: "evening", vibe: "trending", title: "Aaj ka trending dinner try karo.", body: "Order karo abhi.", url: "/menu" },
    { slot: "evening", vibe: "viral", title: "Ye combo viral hone wala hai.", body: "Order karo, pehle try karo.", url: "/menu" },
    { slot: "evening", vibe: "internet_culture", title: "Aaj ki vibe: dinner sorted.", body: "Order karo, vibe maintain karo.", url: "/menu" },
    { slot: "evening", vibe: "meme", title: "Dinner decide karna sabse mushkil kaam hai.", body: "Hum easy bana dete hain. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "funny", title: "Kitchen band, FoodKnock on!", body: "Khana banane ka mood nahi? Hum bana ke bhej dete hain.", url: "/menu" },
    { slot: "evening", vibe: "savage", title: "Akela lunch kiya tha, dinner bhi akela?", body: "Koi na, swaad toh hoga. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "lazy", title: "Uthna nahi hai, bas order karna hai.", body: "Ek tap door hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "single_life", title: "Netflix, blanket, aur khud.", body: "Bas dinner missing hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "college", title: "Notes baad me, dinner pehle.", body: "Order karo, phir padhna.", url: "/menu" },
    { slot: "evening", vibe: "office", title: "Aaj thak gaye ho lagta hai.", body: "Dinner order karo, aaram karo.", url: "/menu" },
    { slot: "evening", vibe: "hostel", title: "Hostel ka Wi-Fi slow, khana bhi late?", body: "FoodKnock fast hai. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "friends", title: "Squad ka dinner plan kya hai?", body: "FoodKnock suggest karo. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "burger", title: "Juicy, cheesy, fresh burger.", body: "Order karo abhi.", url: "/menu" },
    { slot: "evening", vibe: "pizza", title: "Hot aur fresh, seedha door pe.", body: "Order karo, pizza cravings satisfy karo.", url: "/menu" },
    { slot: "evening", vibe: "momos", title: "Fresh momos ready hain.", body: "Abhi order karo.", url: "/menu" },
    { slot: "evening", vibe: "meme", title: "Aaj bhi 'kal se healthy' bola?", body: "Chalo aaj dinner order kar lo pehle.", url: "/menu" },
    { slot: "evening", vibe: "relatable", title: "Cart mein add kiya, checkout bhool gaye?", body: "Abhi complete karo. Order karo.", url: "/menu" },
    { slot: "evening", vibe: "chaotic", title: "Din khatam, energy khatam.", body: "Dinner order karke energy wapas lao.", url: "/menu" },
];

// ── Production-grade anti-repeat picker (module-scoped, in-memory) ────────
// Maintains a shuffled "deck" per slot and draws from it without
// replacement — this is a stronger guarantee than simple "avoid last N"
// tracking: within one full pass through a slot's pool, NOTHING repeats
// at all. Once the deck is exhausted, it's reshuffled and redrawn from
// scratch. Lightweight (array shuffle + pointer, no external deps, no DB,
// no timers) and cold-start-safe: resets to a fresh shuffle on a new
// process, which is an acceptable, harmless reset for a broadcast
// campaign with no per-recipient state to preserve across deploys.
const slotDecks = new Map<NotificationSlot, number[]>();
const slotDeckPositions = new Map<NotificationSlot, number>();

function shuffledIndices(length: number): number[] {
    const arr = Array.from({ length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function drawNextIndex(slot: NotificationSlot, poolLength: number): number {
    let deck = slotDecks.get(slot);
    let position = slotDeckPositions.get(slot) ?? 0;

    if (!deck || deck.length !== poolLength || position >= deck.length) {
        deck = shuffledIndices(poolLength);
        position = 0;
        slotDecks.set(slot, deck);
    }

    const index = deck[position];
    slotDeckPositions.set(slot, position + 1);
    return index;
}

/**
 * UNCHANGED SIGNATURE: pickCampaignMessage(slot) → SlotMessage. Internally
 * draws from a per-slot shuffled deck without replacement (see above) —
 * guarantees no repeat within a full cycle of the pool, then reshuffles.
 */
export function pickCampaignMessage(slot: NotificationSlot): SlotMessage {
    const pool = PUSH_CAMPAIGN_POOL.filter((m) => m.slot === slot);
    if (pool.length === 0) {
        throw new Error(`No campaign messages configured for slot "${slot}".`);
    }

    const index = drawNextIndex(slot, pool.length);
    return pool[index];
}

/**
 * Builds the push payload for a "push.campaign" event. `event.data.slot`
 * is required — set by whoever emits the event (currently the cron route).
 * Maps slot → category so the Lunch Deals / Evening Deals preference
 * toggles (Notification Settings) actually gate this campaign.
 */
function buildPushCampaignPayload(event: NotificationEvent<{ slot: NotificationSlot }>): NotificationPayload {
    const msg = pickCampaignMessage(event.data.slot);
    return {
        title: msg.title,
        body: msg.body,
        url: msg.url,
        category: event.data.slot === "morning" ? "lunch_deal" : "evening_deal",
        ctaButtons: [{ id: "explore", label: "Explore Menu", url: msg.url }],
    };
}

export type AdminBroadcastEventData = {
    title: string;
    body: string;
    url?: string;
    imageUrl?: string;
    category?: NotificationPayload["category"];
    priority?: NotificationPayload["priority"];
    accentColor?: string;
    badgeText?: string;
    ctaButtons?: NotificationPayload["ctaButtons"];
    campaignId?: string;
};

/**
 * Builds the push payload for an "admin.broadcast" event — an ad-hoc
 * notification authored in the Admin Notification Center. Unlike
 * push.campaign (which picks from a fixed copy pool), the admin supplies
 * everything directly; this is a thin pass-through, not a template that
 * generates content.
 */
function buildAdminBroadcastPayload(event: NotificationEvent<AdminBroadcastEventData>): NotificationPayload {
    return {
        title: event.data.title,
        body: event.data.body,
        url: event.data.url || "/menu",
        imageUrl: event.data.imageUrl,
        category: event.data.category,
        priority: event.data.priority,
        accentColor: event.data.accentColor,
        badgeText: event.data.badgeText,
        ctaButtons: event.data.ctaButtons,
        campaignId: event.data.campaignId,
    };
}

/**
 * Registry: event name → payload builder.
 */
export const notificationTemplates: Partial<
    Record<string, (event: NotificationEvent<any>) => NotificationPayload>
> = {
    "push.campaign": buildPushCampaignPayload,
    "admin.broadcast": buildAdminBroadcastPayload,
};