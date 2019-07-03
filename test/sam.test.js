import { expect } from "chai"

import SAM from '../lib/SAM'
import { step, E, first } from '../lib/sam-utils'

describe('SAM tests', function() {
  describe('loop', function() {
    it('create an intent', function() {
        SAM({
            initialState: {
                counter: 10,
                status: 'ready'
            }
        })

        const { intents } = SAM({
            component: {
                actions: [
                    () => ({test: true})
                ]
            }
        })
        expect(first(intents)).to.exist 
    });

    it('add an acceptor', function() {
        SAM({
            component: {
                acceptors: [
                    model => ({ test }) => {
                        if (test) {
                          model.status = 'testing'
                        }
                    }
                ]
            }, 
            render: (state) => expect(state.status).to.equal('testing')
        })
    });
  });
});