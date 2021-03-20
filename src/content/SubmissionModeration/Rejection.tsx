import { useState } from 'preact/hooks';
import { flairPost, updateModmail, postStickyComment, removePost, useToggleState, SubredditRule } from '../utils';

interface Props {
  show: boolean;
  rules: SubredditRule[];
  onHide: (e: Event) => void;
  onReject: (errors: string[]) => void;
}

const getRuleLetters = (reasons: Set<string>): string[] => {
  return [...reasons]
    .map(reason => reason.match(/\w:/)?.[0].substr(0, 1))
    .filter(Boolean)
    .sort() as string[]; // assertion is necessary because TS misses the filter
};

const createRejectionComment = (ruleLetters: string[]) => {
  const multipleRules = ruleLetters.length > 1;
  let formattedRuleLetters = '';

  if (multipleRules) {
    const lastLetter = ruleLetters[ruleLetters.length - 1];
    formattedRuleLetters = ruleLetters.slice(0, ruleLetters.length - 1).join(', ');
    formattedRuleLetters = `${ruleLetters} and ${lastLetter}`;
  } else {
    formattedRuleLetters = ruleLetters.join('');
  }

  // TODO: externalize this - wiki?
  return `Hello there. I'm a mod in /r/NeutralPolitics.

We appreciate your participation in the sub, but we did not approve this submission, because it doesn't conform to our [submission rules.](http://www.reddit.com/r/NeutralPolitics/wiki/guidelines#wiki_submission_rules)

Specifically, rule${multipleRules ? 's' : ''} ${formattedRuleLetters}.

If you'd like to submit a reworked version of your post after [reviewing the guidelines,](http://www.reddit.com/r/NeutralPolitics/wiki/guidelines) we'd be happy to consider it.

Thanks for understanding.

* *Note: If you wish to discuss this topic under more relaxed submission rules, consider posting to our sister subreddit, /r/NeutralTalk.*
`;
};

export default function Rejection({ show, rules, onHide, onReject }: Props) {
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [postComment, togglePostComment] = useToggleState(true);
  const [sendModmail, toggleSendModmail] = useToggleState(true);
  const [removeFromQueue, toggleRemoveFromQueue] = useToggleState(true);
  const [isLoading, setIsLoading] = useState(false);

  const toggleSelectedReason = (rule: string) => {
    if (selectedReasons.has(rule)) {
      const updated = new Set(selectedReasons);
      updated.delete(rule);
      setSelectedReasons(updated);
    } else {
      setSelectedReasons(new Set(selectedReasons).add(rule));
    }
  };

  const handleRejection = async (evt: MouseEvent) => {
    evt.preventDefault();

    if (selectedReasons.size === 0) {
      return;
    }

    const ruleLetters = getRuleLetters(selectedReasons);
    const rejectionComment = createRejectionComment(ruleLetters);
    const flair = `${ruleLetters.join(', ')}`;
    const modmailMessage = `Rejected: ${flair}`;
    const errors: string[] = [];

    setIsLoading(true);

    await Promise.all([
      flairPost(flair).catch(err => {
        errors.push('Could not flair post');
      }),
      sendModmail
        ? updateModmail(modmailMessage).catch(err => {
            errors.push('Could not update modmail');
          })
        : null,
      postComment
        ? postStickyComment(rejectionComment).catch(err => {
            errors.push('Could not post sticky comment');
          })
        : null,
      removeFromQueue
        ? removePost().catch(err => {
            errors.push('Could not remove post from queue');
          })
        : null,
    ]);

    onReject(errors);
    setIsLoading(false);

    if (!postComment) {
      const textarea = document.querySelector('.commentarea textarea') as HTMLTextAreaElement;
      textarea.value = rejectionComment;
      textarea.style.height = '440px';
      textarea.focus();
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div style={{ padding: '10px 20px', fontSize: '1.2em', border: '1px solid #ccc' }}>
      {!rules.length && <div className="error">This subreddit has no rules!</div>}

      {rules.map(rule => (
        <div style={{ marginBottom: 5 }}>
          <input
            type="checkbox"
            checked={selectedReasons.has(rule.short_name)}
            onChange={() => toggleSelectedReason(rule.short_name)}
            name={rule.short_name}
            id={rule.short_name}
            style={{ marginRight: 5 }}
          />
          <label for={rule.short_name}>{rule.short_name}</label>
        </div>
      ))}

      <div>
        <input
          type="checkbox"
          checked={postComment}
          onChange={togglePostComment}
          name="postComment"
          id="postComment"
          style={{ marginRight: 5, marginTop: 10 }}
        />
        <label for="postComment">Post rejection comment</label>
      </div>

      <div>
        <input
          type="checkbox"
          checked={removeFromQueue}
          onChange={toggleRemoveFromQueue}
          name="removeFromQueue"
          id="removeFromQueue"
          style={{ marginRight: 5, marginTop: 5 }}
        />
        <label for="removeFromQueue">Remove post from queue</label>
      </div>

      <div>
        <input
          type="checkbox"
          checked={sendModmail}
          onChange={toggleSendModmail}
          name="sendModmail"
          id="sendModmail"
          style={{ marginRight: 5, marginTop: 5 }}
        />
        <label for="sendModmail">Update modmail</label>
      </div>

      <div style={{ marginTop: 15 }}>
        <a href="#" className="pretty-button neutral" onClick={onHide} disabled={isLoading}>
          Cancel
        </a>
        <a href="#" className="pretty-button negative" onClick={handleRejection} disabled={isLoading}>
          {!isLoading ? 'Confirm rejection' : 'Rejecting...'}
        </a>
      </div>
    </div>
  );
}
