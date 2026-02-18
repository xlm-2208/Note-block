const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 80;

const ADMIN_PASSWORD = "sclscl123456789@@@@"; // đổi mật khẩu ở đây

// Tạo thư mục uploads nếu chưa có
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/style.css", express.static(path.join(__dirname, "public/style.css")));
app.get("/ping", (req, res) => {
    res.send("OK");
});

// ===== CẤU HÌNH UPLOAD =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        // Lưu tạm trước
        const tempName = Date.now() + path.extname(file.originalname);
        cb(null, tempName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function (req, file, cb) {

        const allowedExtensions = [".litematic", ".schematic"];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error("Chỉ cho upload .litematic hoặc .schematic"));
        }

        cb(null, true);
    }
});

// ===== TRANG CHỦ =====
app.get("/", (req, res) => {
    fs.readdir("uploads", (err, files) => {

        if (err) return res.send("Lỗi đọc file");

        let fileList = files.map(file =>
            `<div class="file">
                <span>${file}</span>
                <a href="/uploads/${file}" download>Tải</a>
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
            <p style="font-size:12px; opacity:0.6; margin-top:-10px;">
                Dev by nghungly
            </p>
            ${fileList || "<p>Chưa có file nào</p>"}
        </body>
        </html>
        `);
    });
});

// ===== TRANG ADMIN =====
app.get("/admin", (req, res) => {

    fs.readdir("uploads", (err, files) => {

        let fileList = files.map(file => `
            <div class="file">
                <span>${file}</span>
                <form action="/delete" method="POST" style="display:inline;">
                    <input type="hidden" name="filename" value="${file}">
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Xoá</button>
                </form>
            </div>
        `).join("");

        res.send(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Note Block File - Admin</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <h1>🎵 Note Block File - Admin</h1>
            <p style="font-size:12px; opacity:0.6; margin-top:-10px;">
                Dev by nghungly
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
    });
});

// ===== UPLOAD =====
app.post("/upload", upload.single("file"), (req, res) => {

    if (req.body.password !== ADMIN_PASSWORD) {
        return res.send("Sai mật khẩu!");
    }

    if (!req.file) {
        return res.send("Không có file!");
    }

    let customName = req.body.customName || "file";

    // Làm sạch tên (giữ Unicode)
    customName = customName.trim().replace(/[\/\\?%*:|"<>]/g, "");
    customName = customName.replace(/\.+$/, "");

    const ext = path.extname(req.file.originalname).toLowerCase();
    const newName = customName + ext;

    const oldPath = req.file.path;
    const newPath = path.join(__dirname, "uploads", newName);

    // Nếu trùng tên thì thêm timestamp tránh ghi đè
    let finalPath = newPath;
    if (fs.existsSync(finalPath)) {
        finalPath = path.join(__dirname, "uploads", customName + "-" + Date.now() + ext);
    }

    fs.renameSync(oldPath, finalPath);

    res.redirect("/admin");
});

// ===== XOÁ =====
app.post("/delete", (req, res) => {
    const { password, filename } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.send("Sai mật khẩu!");
    }

    const filePath = path.join(__dirname, "uploads", filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    res.redirect("/admin");
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
