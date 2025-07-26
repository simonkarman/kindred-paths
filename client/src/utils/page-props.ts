export interface PageProps<T> {
  params: T,
  searchParams: { [key: string]: string | string[] | undefined }
}
