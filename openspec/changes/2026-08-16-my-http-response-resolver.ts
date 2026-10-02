import { createResolver } from '@quilt/resolver';

export default createResolver({
  name: 'myHttpResponseResolver',
  produces: ['httpResponse'],
  async resolve() {
    return {
      httpResponse: {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'This is my new httpResponse resolver!' }),
      },
    };
  },
});