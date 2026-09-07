const swaggerJsDoc = require("swagger-jsdoc"); // Import swagger-jsdoc untuk membuat dokumentasi OpenAPI dari komentar kode.

const options = {
  // Membuat konfigurasi untuk swagger-jsdoc.
  definition: {
    // Berisi informasi utama tentang API.
    openapi: "3.0.0", // Menentukan versi spesifikasi OpenAPI yang digunakan.

    info: {
      // Info tentang api
      title: "Employee Management API",
      version: "1.0.0", // versi dokumentasi api
      description: "Human Resource Management System API",
    },

    servers: [
      // Daftar server tempat API berjalan.
      {
        url: "http://localhost:3000/",
        description: "Development server",
      },
    ],

    components: {
      // Tempat menyimpan komponen reusable Swagger.
      securitySchemes: {
        // Tempat mendefinisikan metode authentication.
        bearerAuth: {
          // Nama authentication scheme yang akan digunakan.
          type: "http", // Authentication menggunakan HTTP authentication.
          scheme: "bearer", // Menggunakan Bearer Token.
          bearerFormat: "JWT", // Memberi tahu Swagger bahwa token yang digunakan adalah JWT.
        },
      },
    },
  },

  apis: ["./src/controllers/*.js"], // Swagger akan mencari komentar dokumentasi di semua file route .js.
};

const swaggerSpec = swaggerJsDoc(options); // Mengubah konfigurasi dan komentar route menjadi OpenAPI specification (dokumentasi api).

module.exports = swaggerSpec; //Mengekspor konfigurasi Swagger agar bisa digunakan di app.js.
