import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const rawData = fs.readFileSync("data.json");
const data = JSON.parse(rawData);

const allPostDatas = data.allPostDatas;
const allDraftDatas = data.allDraftDatas;
const allTrashDatas = data.allTrashDatas;

const TRASH_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 1 day;

function saveData() {
    fs.writeFileSync("data.json", JSON.stringify({
        allPostDatas,
        allDraftDatas,
        allTrashDatas
    }, null, 2));
}

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (let i = allTrashDatas.length - 1; i >= 0; i--) {
        if (now - allTrashDatas[i].deletedAt > TRASH_EXPIRY_TIME) {
            allTrashDatas.splice(i, 1);
            changed = true;
        }
    }  
    if(changed) saveData(); //only write if something was deleted. 
}, 60 * 60 * 1000); // runs every 1 hour to clean up expired trash posts.

// Starting routes from here

app.get("/", (req, res) => {

  const postExcerpt = allPostDatas.map(post => {
    const plainText = (post.postBody || '').replace(/<[^>]+>/g, '');
    return {
        ...post,
        excerpt: plainText.length > 120 ? plainText.substring(0, 120) + '...' : plainText
    };
  });
  
  res.render("index.ejs", { 
    allPostDatas: postExcerpt,
    PostCount: allPostDatas.length,
    DraftCount: allDraftDatas.length,
    TrashCount: allTrashDatas.length 
});

});

app.get("/new-post", (req, res) => {    
    res.render("createpost.ejs");
});

app.get("/search", (req, res) => {
    const query = req.query.q.toLowerCase();

    const searchResults = allPostDatas.filter(post => 
        post.postTitle.toLowerCase().includes(query)
    ).map(post => ({
        ...post,
        excerpt: post.postBody && post.postBody.length > 120 ? post.postBody.substring(0, 120) + '...'
        : post.postBody || ''
    }));

    res.render("index.ejs", {
        allPostDatas: searchResults,
        PostCount: allPostDatas.length,
        DraftCount: allDraftDatas.length,
        TrashCount: allTrashDatas.length,
        searchQuery: query,
    })
});

app.post("/create-post", (req, res) => { 

    const uniqueId = uuidv4();

    const postData = { postTitle: req.body["post-title"],
        postBody: req.body["post-body"],
        postID: uniqueId,
        createdAt: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }; 

    if(req.body.action === "draft") {
        allDraftDatas.push(postData);
        saveData();
        res.redirect("/drafts");
    } else {
        allPostDatas.push(postData);
        saveData();
        res.redirect("/");
    }    

    console.log(postData);    
    
});

app.get("/drafts", (req, res) => {

    const postExcerptDraft = allDraftDatas.map(post => {
        const plainText = (post.postBody || '').replace(/<[^>]+>/g, '');
        return {
            ...post,
            excerpt: plainText.length > 120 ? plainText.substring(0, 120) + '...' : plainText
        };
    });

    res.render("draftpost.ejs", { 
        allDraftDatas: postExcerptDraft,
        PostCount: allPostDatas.length,
        DraftCount: allDraftDatas.length,
        TrashCount: allTrashDatas.length 
    });
});

app.get("/trash", (req, res) => {

    const postExcerptTrash = allTrashDatas.map(post => {
        const plainText = (post.postBody || '').replace(/<[^>]+>/g, '');
        return {
            ...post,
            excerpt: plainText.length > 120 ? plainText.substring(0, 120) + '...' : plainText
        };
    });

    res.render("trashpost.ejs", { 
        allTrashDatas: postExcerptTrash,
        PostCount: allPostDatas.length,
        DraftCount: allDraftDatas.length,
        TrashCount: allTrashDatas.length 
    });
});

app.get("/read-more", (req, res) => {

    const showExistingPost = allPostDatas.find(postData => postData.postID === req.query.id)
    || allDraftDatas.find(postData => postData.postID === req.query.id);

    if (!showExistingPost) {
        return res.status(404).send("Post not found");
    }

    res.render("fullpost.ejs", { 
        showTitle: showExistingPost.postTitle,
        showBody: showExistingPost.postBody,
        showID: showExistingPost.postID,
        PostCount: allPostDatas.length,
        DraftCount: allDraftDatas.length,
        TrashCount: allTrashDatas.length
    });
});

app.get("/edit-post", (req, res) => {

    const getID = req.query.id;
    const from = req.query.from || "home";
    
    const editPostData = allPostDatas.find(postData => postData.postID === getID)
     || allDraftDatas.find(postData => postData.postID === getID);
    
    //prefill data 
    res.render("createpost.ejs", { 
        editTitle: editPostData.postTitle, 
        editBody: editPostData.postBody, 
        editID: editPostData.postID,
        from: from,
        PostCount: allPostDatas.length,
        DraftCount: allDraftDatas.length,
        TrashCount: allTrashDatas.length
     });
        
});


app.post("/action", (req, res) => {

    const isPublished = allPostDatas.find(postData => postData.postID === req.query.id);
    const postIndex = allPostDatas.findIndex(postData => postData.postID === req.query.id);
    const DraftIndex = allDraftDatas.findIndex(postData => postData.postID === req.query.id);
    const isDraft = DraftIndex !== -1;
    const trashIndex = allTrashDatas.findIndex(postData => postData.postID === req.query.id);
    const isTrash = trashIndex !== -1;

    const postToUpdate = isPublished || allDraftDatas[DraftIndex] || allTrashDatas[trashIndex];

    if (!postToUpdate) return res.status(404).send("Post not found");

    // update content first regardless of action
    postToUpdate.postTitle = req.body["post-title"];
    postToUpdate.postBody = req.body["post-body"];

    if (req.body.action === "draft") {
        if (postIndex !== -1) allPostDatas.splice(postIndex, 1);
        if (isTrash) allTrashDatas.splice(trashIndex, 1);
        if (!isDraft) allDraftDatas.push(postToUpdate);
        saveData();
        return res.redirect("/drafts");
    }

    // action === "update"
    if (isDraft) {
        allDraftDatas.splice(DraftIndex, 1);
        allPostDatas.push(postToUpdate);
        saveData();
    }
    if (isTrash) {
        allTrashDatas.splice(trashIndex, 1);
        allPostDatas.push(postToUpdate);
        saveData();
    }

    return res.redirect(`/read-more?id=${postToUpdate.postID}`);
});

app.delete("/deletePost", (req, res) => {

    const postID = req.query.id;

    const postIndex = allPostDatas.findIndex(
        post => post.postID === postID
    )

    if (postIndex !== -1) {
        const deletedPost = allPostDatas[postIndex];
        deletedPost.deletedAt = Date.now(); 
        deletedPost.deletedAtFormatted = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });       
        deletedPost.origin = "published";
        allPostDatas.splice(postIndex, 1);
        allTrashDatas.push(deletedPost);
        saveData();
        return res.json({success: true});
    }

    const DraftIndex = allDraftDatas.findIndex(
        post => post.postID === postID
    );

    if (DraftIndex !== -1) {
        const deletedPost = allDraftDatas[DraftIndex];
        deletedPost.deletedAt = Date.now();
        deletedPost.deletedAtFormatted = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
        deletedPost.origin = "draft";
        allDraftDatas.splice(DraftIndex, 1);
        allTrashDatas.push(deletedPost);
        saveData();
        return res.json({success: true});
    }

    const trashIndex = allTrashDatas.findIndex(
        post => post.postID === postID
    );

    if (trashIndex !== -1) {  
        allTrashDatas.splice(trashIndex, 1);
        return res.json({success: true});
    }

    res.status(404).send("Post not found!");

});

app.get("/restore-post", (req, res) => {
    const postID = req.query.id;

    const trashIndex = allTrashDatas.findIndex(
        post => post.postID === postID
    );

    if (trashIndex !== -1) {
        const restoredPost = allTrashDatas[trashIndex];
        allTrashDatas.splice(trashIndex, 1);
        if (restoredPost.origin === "published") {
        allPostDatas.push(restoredPost);
        saveData();
        return res.redirect("/trash");
        } else if (restoredPost.origin === "draft") {
            allDraftDatas.push(restoredPost);
            saveData();
            return res.redirect("/trash");
        }        
    }

    res.status(404).send("Post not found!");
});


//for render app to listen on port 3000
app.listen(port, "0.0.0.0", () => {
    console.log(`Server Running on port ${port}`);
});

export default app;