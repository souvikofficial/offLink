const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hardwareId = 'test-device-id';
  const deviceToken = 'test-device-token-secret'; // Default in mobile app
  const deviceName = 'Test Device (Mobile Client)';

  const userEmail = 'demo@offsync.com';
  const userPassword = 'password123';
  
  // 1. Create/Update User
  const passwordHash = await bcrypt.hash(userPassword, 10);
  
  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      password: passwordHash, // Update password in case it changed
    },
    create: {
      email: userEmail,
      password: passwordHash,
      name: 'Demo User',
    },
  });
  
  console.log(`User seeded: ${user.email} (ID: ${user.id})`);

  // 2. Create/Update Device linked to User
  const tokenHash = await bcrypt.hash(deviceToken, 10);

  const device = await prisma.device.upsert({
    where: { hardwareId },
    update: {
      apiTokenHash: tokenHash,
      name: deviceName,
      ownerId: user.id, // Ensure it's owned by our demo user
    },
    create: {
      hardwareId,
      ownerId: user.id,
      apiTokenHash: tokenHash,
      name: deviceName,
      model: 'Simulator',
    },
  });

  console.log(`Device seeded: ${device.hardwareId}`);
  console.log('------------------------------------------------');
  console.log('Login to dashboard with:');
  console.log(`Email: ${userEmail}`);
  console.log(`Password: ${userPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
