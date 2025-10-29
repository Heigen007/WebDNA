import { ICreatePayload, IUpdatePayload, IControlPayload, IClosePayload, RemedyEventName } from '../telegramNotify/types/remedy'
import { logger } from '../common/logger'
import fs from 'fs'
import path from 'path'

export interface INotificationRecord {
    id: string
    entityId: string
    eventName: RemedyEventName
    payload: ICreatePayload | IUpdatePayload | IControlPayload | IClosePayload
    formattedMessage: string
    timestamp: Date
}

export class NotificationHistory {
    private static instance: NotificationHistory
    private notifications: INotificationRecord[] = []
    private maxRecords = 20 // Храним максимум 20 записей
    private readonly filePath: string

    private constructor() {
        this.filePath = path.join(process.cwd(), 'data', 'notifications.json')
        this.ensureDataDirectory()
        this.loadFromFile()
    }

    public static getInstance(): NotificationHistory {
        if (!NotificationHistory.instance) {
            NotificationHistory.instance = new NotificationHistory()
        }
        return NotificationHistory.instance
    }

    private ensureDataDirectory(): void {
        const dataDir = path.dirname(this.filePath)
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
            logger.info(`NotificationHistory: Created data directory: ${dataDir}`)
        }
    }

    private loadFromFile(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8')
                const parsed = JSON.parse(data)
                
                // Восстанавливаем объекты Date
                this.notifications = parsed.map((notification: any) => ({
                    ...notification,
                    timestamp: new Date(notification.timestamp)
                }))
                
                logger.info(`NotificationHistory: Loaded ${this.notifications.length} notifications from file`)
            } else {
                logger.info('NotificationHistory: No existing file found, starting with empty history')
            }
        } catch (error) {
            logger.error('NotificationHistory: Error loading from file:', error)
            this.notifications = []
        }
    }

    private saveToFile(): void {
        try {
            const data = JSON.stringify(this.notifications, null, 2)
            fs.writeFileSync(this.filePath, data, 'utf8')
            logger.debug(`NotificationHistory: Saved ${this.notifications.length} notifications to file`)
        } catch (error) {
            logger.error('NotificationHistory: Error saving to file:', error)
        }
    }

    public addNotification(
        entityId: string,
        eventName: RemedyEventName,
        payload: ICreatePayload | IUpdatePayload | IControlPayload | IClosePayload,
        formattedMessage: string
    ): void {
        const notification: INotificationRecord = {
            id: this.generateId(),
            entityId,
            eventName,
            payload,
            formattedMessage,
            timestamp: new Date()
        }

        this.notifications.unshift(notification) // Добавляем в начало

        // Ограничиваем количество записей
        if (this.notifications.length > this.maxRecords) {
            this.notifications = this.notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, this.maxRecords)
        }

    this.saveToFile()
        logger.info(`NotificationHistory: Added notification ${notification.id} for entity ${entityId}`)
    }

    public getLatestNotifications(limit: number = 20): INotificationRecord[] {
        return this.notifications.slice(0, limit)
    }

    public getStats(): { total: number, byType: { [key: string]: number } } {
        const byType: { [key: string]: number } = {}
        
        this.notifications.forEach(notification => {
            byType[notification.eventName] = (byType[notification.eventName] || 0) + 1
        })

        return {
            total: this.notifications.length,
            byType
        }
    }

    private generateId(): string {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }
}