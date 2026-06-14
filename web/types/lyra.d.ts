declare module "@lyracom/embedded-form-glue" {
  interface KR {
    setFormConfig(config: Record<string, string>): Promise<{ KR: KR }>;
    renderElements(selector: string): Promise<{ KR: KR }>;
    removeForms(): Promise<void>;
    onSubmit(callback: (paymentData: unknown) => boolean): Promise<{ KR: KR }>;
    onError(callback: (error: unknown) => void): Promise<{ KR: KR }>;
  }

  interface KRGlue {
    loadLibrary(endpoint: string, publicKey: string): Promise<{ KR: KR }>;
  }

  const KRGlue: KRGlue;
  export default KRGlue;
}
