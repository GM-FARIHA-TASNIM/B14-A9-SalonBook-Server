import "dotenv/config";
import { connectDB, getDB, mongoClient } from "../config/db.js";

const services = [
  {
    seedKey: "salonbook-1",
    name: "Signature Haircut & Styling",
    category: "Hair",
    description: "A personalized haircut and professional styling.",
    price: 1800,
    duration: 60,
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&auto=format&fit=crop",
    featured: true,
  },
  {
    seedKey: "salonbook-2",
    name: "Luxury Hair Spa",
    category: "Hair",
    description: "Deep nourishment for soft and healthy hair.",
    price: 2500,
    duration: 75,
    image:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=900&auto=format&fit=crop",
    featured: true,
  },
  {
    seedKey: "salonbook-3",
    name: "Radiance Facial",
    category: "Facial",
    description: "A refreshing facial for naturally glowing skin.",
    price: 2200,
    duration: 60,
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&auto=format&fit=crop",
    featured: true,
  },
  {
    seedKey: "salonbook-4",
    name: "Classic Manicure",
    category: "Nails",
    description: "Professional nail shaping, care and polish.",
    price: 1200,
    duration: 45,
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=900&auto=format&fit=crop",
    featured: false,
  },
  {
    seedKey: "salonbook-5",
    name: "Bridal Makeup",
    category: "Makeup",
    description: "Elegant, long-lasting makeup for your special day.",
    price: 8500,
    duration: 150,
    image:
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&auto=format&fit=crop",
    featured: true,
  },
  {
    seedKey: "salonbook-6",
    name: "Relaxing Body Spa",
    category: "Spa",
    description: "A calming treatment for complete relaxation.",
    price: 3500,
    duration: 90,
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=900&auto=format&fit=crop",
    featured: false,
  },
];

async function seedServices() {
  try {
    await connectDB();

    const collection = getDB().collection("services");

    let inserted = 0;
    let existing = 0;

    for (const service of services) {
      const { seedKey, ...serviceData } = service;

      const result = await collection.updateOne(
        { seedKey },
        {
          $setOnInsert: {
            seedKey,
            ...serviceData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        inserted++;
        console.log(`Inserted: ${service.name}`);
      } else {
        existing++;
        console.log(`Already exists: ${service.name}`);
      }
    }

    console.log("\nSalonBook services seed completed!");
    console.log(`Inserted: ${inserted}`);
    console.log(`Already existing: ${existing}`);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoClient.close();
  }
}

seedServices();
