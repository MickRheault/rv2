import { NextRequest, NextResponse } from 'next/server'
import { shopService } from '@/services/shops'
import { aiService } from '@/services/ai'

export async function POST(req: NextRequest) {
    // 1. Verify Webhook Secret
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await req.json()
        const { type, table, record, old_record } = payload

        // 2. Validate Event Type
        if (type !== 'UPDATE' || table !== 'rental_shops') {
            return NextResponse.json({ message: 'Ignored: Not a shop update' }, { status: 200 })
        }

        // 3. Check if relevant fields changed to avoid infinite loops
        // We don't want to re-trigger if we just updated the description ourselves.
        // Logic: If only 'business_description' changed, ignore it.
        // Better Logic: Check if 'business_description' in NEW record is different from processed.
        // Ideally, we'd check if specific fields like 'provider_name' changed, or if a specific flag was set.
        // For this POC, let's assume we trigger if description is EMPTY or if explicitly requested (maybe via a column).
        // Or simpler: If the description is the SAME as the old record, but other fields changed, we might update.

        // Safety check: If the new description matches what we just generated (hard to know), or if we are the ones who updated it.
        // A common pattern is to have a `metadata` column or `last_updated_by` but let's keep it simple.

        // Let's rely on a diff: If description didn't change, but (tours, inclusions, name) did, we regenerate.
        // Supabase webhook payload only contains the TABLE data, not relations.
        // So we can check if `provider_name` or `full_address` changed.

        const relevantFields = ['provider_name', 'full_address', 'opening_hours']
        const hasRelevantChanges = relevantFields.some(field => record[field] !== old_record[field])

        // Also trigger if description is empty
        const descriptionIsEmpty = !record.business_description || record.business_description.trim() === ''

        if (!hasRelevantChanges && !descriptionIsEmpty) {
            return NextResponse.json({ message: 'Ignored: No relevant changes' }, { status: 200 })
        }

        const shopId = record.id

        // 4. Fetch Full Context
        // We need relations (tours, inclusions) which are NOT in the webhook payload
        const fullShop = await shopService.getShopById(shopId)

        // 5. Generate with AI
        const newDescription = await aiService.generateShopDescription(fullShop)

        if (!newDescription) {
            return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 })
        }

        // 6. Update Shop
        // IMPORTANT: This will trigger another webhook!
        // We must ensure our start-of-function logic prevents infinite loops.
        // If we update `business_description`, the next webhook will have `business_description` changed.
        // Our check `!hasRelevantChanges` might fail if we rely only on other fields.
        // But `record.business_description` WILL be different from `old_record.business_description`.
        // So we need to detect if *only* description changed.

        // Refined logic for step 3:
        // If `business_description` changed, AND no other relevant fields changed, it's likely our own update => Ignore.
        // (Unless the user manually changed the description, in which case we might want to respect it or overwrite it? 
        // Usually manual override should be respected. Let's assume for this POC we overwrite if other fields change).

        // Logic:
        // If (Relevant Fields Changed OR Description is Empty) -> Generate
        // Else -> Ignore

        // Wait, if I update description, the next webhook has:
        // record.desc = NEW, old.desc = OLD. 
        // relevant_fields = SAME.
        // So `hasRelevantChanges` will be false.
        // `descriptionIsEmpty` will be false (if we generated something).
        // So it will return "Ignored" -> Loop prevented. Correct.

        await shopService.updateShop(shopId, {
            business_description: newDescription
        })

        return NextResponse.json({
            success: true,
            message: 'Description updated',
            shopId,
            newLength: newDescription.length
        })

    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
