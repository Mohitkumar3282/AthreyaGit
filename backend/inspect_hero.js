import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HeroConfig from './app/models/heroConfig.js';
import ExperienceSection from './app/models/experienceSection.js';

dotenv.config();

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const configs = await HeroConfig.find({});
        console.log('HeroConfigs in DB:', JSON.stringify(configs, null, 2));

        const sections = await ExperienceSection.find({});
        console.log('ExperienceSections in DB:', JSON.stringify(sections, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
