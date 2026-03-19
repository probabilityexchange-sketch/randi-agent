module.exports = {
  schema: 'prisma/schema.prisma',
  datasource: {
    url:
      process.env.DIRECT_URL ||
      'postgresql://postgres.uoltahlxvmuyznfthgxv:YgTO8BWW2zGWK6qR@aws-1-us-east-2.supabase.co:65432/postgres',
  },
};
