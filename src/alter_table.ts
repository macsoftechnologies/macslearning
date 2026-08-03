import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
    type: "mysql",
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "", 
    database: "macslearn",
});

AppDataSource.initialize()
    .then(async () => {
        console.log("Data Source has been initialized!");
        try {
            await AppDataSource.query(`ALTER TABLE programs ADD COLUMN certificateTemplateId VARCHAR(255) NULL`);
        } catch (e) { console.log(e.message); }
        try {
            await AppDataSource.query(`ALTER TABLE programs ADD COLUMN certificateIssueMode ENUM('AUTO', 'MANUAL_APPROVAL') NULL DEFAULT 'AUTO'`);
        } catch (e) { console.log(e.message); }
        console.log("Columns added successfully");
        process.exit(0);
    })
    .catch((err: any) => {
        console.error("Error during Data Source initialization", err);
        process.exit(1);
    });
