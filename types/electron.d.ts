export {};

declare global {
  interface Window {
    electron: {
      character: {
        uploadImage: (payload: any) => Promise<any>;
        generate: (payload: any) => Promise<any>;
      };
      product: {
        uploadImage: (payload: any) => Promise<any>;
        generateScene: (payload: any) => Promise<any>;
      };
      marketing: {
        generateStoryboard: (payload: any) => Promise<any>;
      };
    };
  }
}
