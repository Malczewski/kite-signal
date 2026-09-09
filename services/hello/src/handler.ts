export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
  console.log('kite-signal hello invoked', JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'kite-signal hello: Terraform + Lambda + IAM + logging wired up' }),
  };
};
