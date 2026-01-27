import OpenAI from 'openai'
import { ShopWithDetails } from './shops'

const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.warn('OPENAI_API_KEY is not set. AI features will not work.')
        return null
    }
    return new OpenAI({ apiKey })
}

export const aiService = {
    /**
     * Generates a compelling business description for a rental shop based on its details.
     */
    async generateShopDescription(shop: ShopWithDetails): Promise<string | null> {
        const openai = getOpenAIClient()
        if (!openai) return null

        // Construct a rich context from shop data
        const features = [
            shop.rental_shop_tours.length > 0 ? `Offers guided tours: ${shop.rental_shop_tours.map(t => t.name).join(', ')}` : null,
            shop.rental_shop_inclusions.length > 0 ? `Includes: ${shop.rental_shop_inclusions.map(i => i.inclusion_text).join(', ')}` : null,
            shop.full_address ? `Located at: ${shop.full_address}` : null,
        ].filter(Boolean).join('\n')

        const prompt = `
      You are a professional copywriter for a motorcycle rental platform.
      Write a compelling, SEO-friendly business description for a rental shop named "${shop.provider_name}".
      
      Key Details:
      ${features}
      
      Current Description (if any): "${shop.business_description || ''}"
      
      The description should be engaging, trustworthy, and highlight their unique selling points. 
      Keep it under 3 paragraphs. Focus on the experience of riding and the convenience of their service.
      Do not invent specific details not provided, but you can infer general quality and service level.
    `

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o', // or gpt-3.5-turbo if cost is a concern
                messages: [
                    { role: 'system', content: 'You are a helpful assistant for RideVault.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            })

            return response.choices[0]?.message?.content || null
        } catch (error) {
            console.error('Error generating description with OpenAI:', error)
            return null
        }
    }
}
