const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_FOLDER = "files";

const ADMIN_PASSWORD = "sclscl123456789@@@@";

// ===== ENV =====
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const STORAGE_REPO = process.env.STORAGE_REPO;
const BRANCH = "main";

if (!GITHUB_TOKEN || !GITHUB_USERNAME || !STORAGE_REPO) {
    console.error("Missing GitHub environment variables!");
}

// ===== BASIC =====
app.use(express.urlencoded({ extended: true }));
app.use("/style.css", express.static(path.join(__dirname, "public/style.css")));

app.get("/ping", (req, res) => {
    res.status(200).send("OK");
});

// ===== MULTER (temporary local only) =====
const upload = multer({
    dest: "temp/",
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowed = [".litematic", ".schematic"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
            return cb(new Error("Chỉ cho upload .litematic hoặc .schematic"));
        }
        cb(null, true);
    }
});

// ===== HELPER =====
const githubAPI = axios.create({
    baseURL: `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}`,
    headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
    }
});

// ===== TRANG CHỦ =====
app.get("/", async (req, res) => {
    try {
        const response = await githubAPI.get(`/contents/${GITHUB_FOLDER}?ref=${BRANCH}`);
        const files = response.data.filter(f =>
            f.type === "file" &&
            [".litematic", ".schematic"].some(ext => f.name.endsWith(ext))
        );

        let fileList = files.map(file =>
            `<div class="file">
                <span>${file.name}</span>
                <a href="${file.download_url}" download>Tải</a>
            </div>`
        ).join("");

        res.send(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Schematic Download</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <h1>Note Block</h1>
            <p style="
                font-size:13px;
                opacity:0.8;
                margin-top:-10px;
            ">
                Dev by Nguyễn Hưng Ly · 
                <a href="https://www.tiktok.com/nghungly"
                target="_blank"
                style="
                    color:#ff0050;
                    font-weight:bold;
                    text-decoration:none;
                ">
                Follow on TikTok
                </a>
            </p>


            ${fileList || "<p>Chưa có file nào</p>"}
        </body>
        </html>
        `);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.send("Lỗi kết nối GitHub");
    }
});

// ===== ADMIN =====
app.get("/admin", async (req, res) => {

    try {
        const response = await githubAPI.get(`/contents/${GITHUB_FOLDER}?ref=${BRANCH}`);
        const files = response.data.filter(f =>
            f.type === "file" &&
            [".litematic", ".schematic"].some(ext => f.name.endsWith(ext))
        );

        let fileList = files.map(file => `
            <div class="file">
                <span>${file.name}</span>
                <form action="/delete" method="POST" style="display:inline;">
                    <input type="hidden" name="filename" value="${file.name}">
                    <input type="hidden" name="sha" value="${file.sha}">
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Xoá</button>
                </form>
            </div>
        `).join("");

        res.send(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Admin</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <h1>🎵 Admin</h1>
            <p style="font-size:12px; opacity:0.6; margin-top:-10px;">
                Dev by Nguyễn Hưng Ly
            </p>

            <form action="/upload" method="POST" enctype="multipart/form-data">
                <input type="password" name="password" placeholder="Password" required><br><br>
                <input type="file" name="file" required><br><br>
                <input type="text" name="customName" placeholder="Nhập tên file" required><br><br>
                <button type="submit">Upload</button>
            </form>

            <hr>
            <h2>Danh sách file</h2>
            ${fileList || "<p>Chưa có file nào</p>"}
        </body>
        </html>
        `);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.send("Lỗi kết nối GitHub");
    }
});

// ===== UPLOAD =====
app.post("/upload", upload.single("file"), async (req, res) => {

    if (req.body.password !== ADMIN_PASSWORD) {
        return res.send("Sai mật khẩu!");
    }

    if (!req.file) {
        return res.send("Không có file!");
    }

    let customName = req.body.customName.trim().replace(/[\/\\?%*:|"<>]/g, "");
    customName = customName.replace(/\.+$/, "");

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileName = customName + ext;

    const content = fs.readFileSync(req.file.path).toString("base64");

    try {
        await githubAPI.put(`/contents/${GITHUB_FOLDER}/${fileName}`, {
            message: `Upload ${fileName}`,
            content: content,
            branch: BRANCH
        });

        fs.unlinkSync(req.file.path);

        res.redirect("/admin");

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.send("Lỗi upload GitHub");
    }
});

// ===== DELETE =====
app.post("/delete", async (req, res) => {

    const { password, filename, sha } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.send("Sai mật khẩu!");
    }

    try {
        await githubAPI.delete(`/contents/${GITHUB_FOLDER}/${filename}`, {
            data: {
                message: `Delete ${filename}`,
                sha: sha,
                branch: BRANCH
            }
        });

        res.redirect("/admin");

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.send("Lỗi xoá file");
    }
});

// ===== START =====
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
