// Named placeholder components: `stubComponent('LinkJob')` renders
// <div data-testid="stub">LinkJob</div> and records the props it received.
import Stub from './Stub.svelte';

export const stubProps = [];

export const stubComponent = (name) => class extends Stub {
  constructor(options) {
    stubProps.push({ name, props: options.props || {} });
    super({ ...options, props: { name } });
  }
};
