# Multi AI Commander (Chrome�g�� ������)

���̃f�B���N�g���ɂ́A������LLM�^�u�֓����Ƀv�����v�g�𑗐M���邽�߂�Chrome�g���@�\�v���g�^�C�v���܂܂�Ă��܂��B

## �\��

- `extension/manifest.json` ? �g���@�\�̃}�j�t�F�X�g
- `extension/background.js` ? �o�b�N�O���E���h(Service Worker)�Ń^�u�����ƃu���[�h�L���X�g�𐧌�
- `extension/sidepanel/` ? �T�C�h�p�l��UI�Ɖ������́E�ݒ����
- `extension/content/` ? ChatGPT / Manus / Grok ��������A�_�v�^

## �Z�b�g�A�b�v�菇

1. Chrome�� `chrome://extensions/` ���J���A�E��́u�f�x���b�p�[���[�h�v���I��
2. �u�p�b�P�[�W������Ă��Ȃ��g���@�\��ǂݍ��ށv����A���̃v���W�F�N�g�� `extension` �t�H���_��I��
3. �Ώ�LLM�T�C�g�Ƀ��O�C�����Ă����A�z�b�g�L�[ `Ctrl+Shift+Y` �ŃT�C�h�p�l����\��
4. �v�����v�g����͂��đ��M��LLM��I������ƁA�Ή��^�u���o�b�N�O���E���h�ō쐬/�ė��p����đ��M����܂�

## ���m�̒��ӓ_

- Manus/Grok��DOM�\���͕p�ɂɕς�邽�߁A`extension/content/*.js` �̃Z���N�^�����ɍ��킹�Ē�������K�v������܂�
- ��A�N�e�B�u�^�u�ł̓��͔��f���x���ꍇ�́A`extension/background.js` �̃f�B���C�ݒ�𒲐����Ă�������
- �������͂�Chrome��Web Speech API�Ɉˑ����܂��B�}�C�N�������u���b�N����Ă���ꍇ�̓{�^��������������܂�

## ����̊g�����

- ���M���s���̃��g���CUI�A���X�|���X�{���̃T�}���[�\��
- Claude, Google AI Studio�����A�_�v�^�̒ǉ�
- �v�����v�g�e���v���[�g��^�O�Ǘ��Ȃǂ̊g���ݒ�
