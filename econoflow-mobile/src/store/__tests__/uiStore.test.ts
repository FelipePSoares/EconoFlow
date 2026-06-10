import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({ hideTabBar: false });
  });

  it('initializes with hideTabBar false', () => {
    expect(useUIStore.getState().hideTabBar).toBe(false);
  });

  it('setHideTabBar(true) sets hideTabBar to true', () => {
    useUIStore.getState().setHideTabBar(true);
    expect(useUIStore.getState().hideTabBar).toBe(true);
  });

  it('setHideTabBar(false) restores hideTabBar to false', () => {
    useUIStore.setState({ hideTabBar: true });
    useUIStore.getState().setHideTabBar(false);
    expect(useUIStore.getState().hideTabBar).toBe(false);
  });
});
