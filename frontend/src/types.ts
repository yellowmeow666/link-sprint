/** 后端创建与列表接口共用的链接记录。shortUrl 由后端拼好，前端不自己拼。 */
export interface LinkRecord {
  code: string
  shortUrl: string
  url: string
  createdAt: string
}
