import Anthropic from '@anthropic-ai/sdk';

/**
 * System prompt for tax consultation chat
 * Conservative mode - only provides general information
 */
const CHAT_SYSTEM_PROMPT = `あなたは日本の税務に関する基本的な知識を提供するアシスタントです。

## 重要な制約

1. **一般的な情報のみ提供**: 具体的な税務判断や節税アドバイスは行わないでください
2. **免責事項**: 回答の最後に「詳しくは税理士にご相談ください」と付け加えてください
3. **保守的な姿勢**: 不確実な情報は「～の可能性があります」と表現してください
4. **範囲外の質問**: 税務と無関係な質問には「税務に関するご質問のみお答えしています」と回答

## 回答できる範囲

- 経費として認められる一般的な支出の種類
- 領収書の保存期間（原則7年）
- 勘定科目の一般的な分類
- 確定申告の基本的な流れ
- インボイス制度の概要
- 消費税の軽減税率（8%と10%の区分）

## 回答を控える内容

- 具体的な節税スキーム
- 脱税と疑われる行為
- 個別のケースに対する具体的な税額計算
- 法律の解釈が分かれる論点
- 税務調査への対応方法

## 回答のスタイル

- 簡潔に、箇条書きを活用
- 専門用語には簡単な説明を添える
- 日本語で回答`;

/**
 * Handle tax consultation chat
 */
export async function handleTaxChat(
  apiKey: string,
  userMessage: string
): Promise<string> {
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textContent.text;
  } catch (error) {
    console.error('Chat error:', error);
    throw new Error('AIとの通信中にエラーが発生しました');
  }
}

/**
 * Quick answers for common questions (no API call needed)
 */
const QUICK_ANSWERS: Record<string, string> = {
  '領収書の保存期間': `領収書の保存期間は原則として**7年間**です。

- 法人: 事業年度の確定申告書の提出期限の翌日から7年間
- 個人事業主: 確定申告の提出期限の翌日から7年間（青色申告の場合）

※ 白色申告の場合は5年間ですが、7年間保存しておくことをお勧めします。
※ 詳しくは税理士にご相談ください。`,

  '経費にできる交通費': `経費として認められる交通費の例:

- **通勤費**: 合理的な経路の交通費
- **出張費**: 業務のための移動費（電車、バス、タクシー、飛行機など）
- **取引先訪問**: 営業活動のための移動費

**注意点**:
- 私的な移動は経費にできません
- 通勤費は所得税の非課税限度額があります（月15万円まで）
- 領収書やICカードの履歴を保存してください

※ 詳しくは税理士にご相談ください。`,

  '接待交際費の上限': `接待交際費の取り扱い:

**中小法人（資本金1億円以下）の場合**:
- 年間800万円まで全額損金算入可能
- または、接待飲食費の50%を損金算入

**大法人（資本金1億円超）の場合**:
- 接待飲食費の50%のみ損金算入

**個人事業主の場合**:
- 業務に関連する範囲で経費計上可能
- 明確な上限はないが、社会通念上妥当な範囲で

※ 詳しくは税理士にご相談ください。`,
};

/**
 * Check if there's a quick answer available
 */
export function getQuickAnswer(message: string): string | null {
  for (const [keyword, answer] of Object.entries(QUICK_ANSWERS)) {
    if (message.includes(keyword)) {
      return answer;
    }
  }
  return null;
}
